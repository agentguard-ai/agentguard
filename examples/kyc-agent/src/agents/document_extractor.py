"""Document Extraction Agent (sub-issue #438 / KYC #3).

Turns a customer document (a fixture ``dict``, not an image) into a
structured :class:`ExtractedIdentity`.

Two modes:

* **Mock mode (default).** A pure, deterministic field mapper over the
  fixture JSON. No LLM, no network, no API keys. Same document in → same
  ``ExtractedIdentity`` out, including ``confidence``.
* **LLM mode (opt-in).** Uses Haystack's ``OpenAIChatGenerator`` to read
  free-form documents. Enabled with ``use_llm=True`` or ``USE_LLM=true``
  plus ``OPENAI_API_KEY``. **Always falls back to mock mode** if Haystack
  is missing, the key is absent, or the call fails — the example must stay
  runnable offline.

Design invariants (mirrors the Decision Agent, #441):

1. Mock mode has no LLM in the loop and is byte-for-byte reproducible.
2. ``confidence`` is computed from a documented, versioned scoring table —
   never guessed. A partially recovered document can never report 1.0,
   because the Decision Agent uses that number as an escalation trigger.
3. Extraction never invents values. A field that is absent from the
   document stays empty; it does not become a plausible-looking string.
4. LLM output is merged *under* the deterministic extraction, and its
   confidence can only lower the result, never raise it.

Boundary: this agent is a pure function over its input. Wrap it with
TealTiger governance at the caller (PII scan on the raw document before,
receipt on the ``ExtractedIdentity`` after). Do not embed governance here.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import date
from pathlib import Path
from collections.abc import Iterable, Mapping
from typing import Any, Optional

try:  # relative import when used as a package (e.g. from #435 scaffold)
    from ..interfaces import ExtractedIdentity
except ImportError:  # fallback for direct src/ sys.path usage in tests
    from interfaces import ExtractedIdentity  # type: ignore[no-redef]

logger = logging.getLogger(__name__)

EXTRACTOR_VERSION = "kyc-document-extractor/v1.0.0"

#: Canonical fixture location produced by sub-issue #437.
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "documents"

DEFAULT_LLM_MODEL = "gpt-4o-mini"


class DocumentExtractionError(ValueError):
    """Raised when a document cannot be read at all (not when fields are missing)."""


# --------------------------------------------------------------------------
# Field aliases — fixture producers name things differently; we accept all of
# them, in declaration order (first hit wins).
# --------------------------------------------------------------------------

_ALIASES: dict[str, tuple[str, ...]] = {
    "first_name": ("first_name", "given_name", "given_names", "forename"),
    "last_name": ("last_name", "surname", "family_name", "lastname"),
    "date_of_birth": ("date_of_birth", "dob", "birth_date", "date_of_birth_iso"),
    "nationality": ("nationality", "issuing_country", "country_of_issue", "country"),
    "document_type": ("document_type", "type", "id_type", "doc_type"),
    "document_number": (
        "document_number",
        "number",
        "doc_number",
        "id_number",
        "passport_number",
    ),
    "document_expiry": (
        "document_expiry",
        "expiry",
        "expiry_date",
        "date_of_expiry",
        "expires",
    ),
    "address": ("address", "residential_address", "street_address"),
}

_FULL_NAME_ALIASES = ("full_name", "name", "holder_name")

#: Nested containers searched, in priority order, before the document root.
_NESTED_KEYS = ("extracted_fields", "id_document", "document", "fields")

#: Address sub-keys, in rendering order.
_ADDRESS_PARTS = (
    "line1",
    "street",
    "line2",
    "city",
    "state",
    "region",
    "province",
    "postal_code",
    "postcode",
    "zip",
    "country",
)

#: Fields that must be present for a document to be fully extracted.
REQUIRED_FIELDS: tuple[str, ...] = (
    "first_name",
    "last_name",
    "date_of_birth",
    "nationality",
    "document_type",
    "document_number",
    "document_expiry",
)

# Confidence scoring table. Change a number here → bump EXTRACTOR_VERSION.
MISSING_FIELD_PENALTY = 0.15
DERIVED_NAME_PENALTY = 0.05
UNPARSED_DATE_PENALTY = 0.05

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_TRUTHY = {"1", "true", "yes", "on"}


# --------------------------------------------------------------------------
# Normalisation helpers (pure)
# --------------------------------------------------------------------------


def _iter_scopes(document: Mapping[str, Any]) -> Iterable[Mapping[str, Any]]:
    """Yield the mappings to search, most specific first.

    ``extracted_fields`` wins over ``id_document`` wins over the root, so a
    fixture that carries both a summary and an extraction detail block
    resolves to the detail block.
    """
    for key in _NESTED_KEYS:
        nested = document.get(key)
        if isinstance(nested, Mapping):
            yield nested
            # One level deeper: customers.json nests extracted_fields inside
            # id_document (see the schema on issue #437).
            for inner_key in _NESTED_KEYS:
                inner = nested.get(inner_key)
                if isinstance(inner, Mapping):
                    yield inner
    yield document


def _lookup(document: Mapping[str, Any], names: tuple[str, ...]) -> Any:
    for scope in _iter_scopes(document):
        for name in names:
            if name in scope and scope[name] not in (None, ""):
                return scope[name]
    return None


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return ""


def _normalise_document_type(value: str) -> str:
    """``"Driver's License"`` → ``"drivers_license"``. Idempotent."""
    if not value:
        return ""
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower().replace("'", ""))
    return slug.strip("_")


def _normalise_country(value: str) -> str:
    """Uppercase an alpha-2 code; leave anything longer untouched."""
    stripped = value.strip()
    if len(stripped) == 2 and stripped.isalpha():
        return stripped.upper()
    return stripped


def _iso_or_none(year: int, month: int, day: int) -> Optional[str]:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _normalise_date(value: str) -> tuple[str, bool]:
    """Return ``(value, parsed)`` with ISO 8601 output where unambiguous.

    Handled: ``YYYY-MM-DD``, ``YYYY/MM/DD``, ``DD Mon YYYY``,
    ``Mon DD, YYYY``, and ``DD/MM/YYYY`` **only** when the first component
    is greater than 12 (day-first is then the only reading).

    Ambiguous numeric forms such as ``03/04/1985`` are returned verbatim
    with ``parsed=False`` rather than guessed at — a silently transposed
    date of birth is a compliance defect, not a rounding error.
    """
    text = value.strip()
    if not text:
        return "", False

    iso = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if iso:
        out = _iso_or_none(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        return (out, True) if out else (text, False)

    dmy = re.fullmatch(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", text)
    if dmy:
        first, second, year = int(dmy.group(1)), int(dmy.group(2)), int(dmy.group(3))
        if first > 12:  # unambiguously day-first
            out = _iso_or_none(year, second, first)
            return (out, True) if out else (text, False)
        return text, False  # ambiguous — never guess

    named = re.fullmatch(
        r"(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})", text
    ) or re.fullmatch(
        r"([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})", text
    )
    if named:
        groups = named.groups()
        if groups[0].isdigit():
            day_s, month_s, year_s = groups
        else:
            month_s, day_s, year_s = groups
        month = _MONTHS.get(month_s[:3].lower())
        if month:
            out = _iso_or_none(int(year_s), month, int(day_s))
            if out:
                return out, True
    return text, False


def _normalise_address(value: Any) -> Optional[str]:
    """Flatten an address string or mapping to a single display line."""
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, Mapping):
        parts = [
            _as_text(value[key]) for key in _ADDRESS_PARTS if _as_text(value.get(key))
        ]
        return ", ".join(parts) or None
    return None


def _split_full_name(full_name: str) -> tuple[str, str]:
    """``"Jane Q. Smith"`` → ``("Jane", "Smith")``; last token is the surname."""
    tokens = [token for token in full_name.split() if token]
    if not tokens:
        return "", ""
    if len(tokens) == 1:
        return tokens[0], ""
    return " ".join(tokens[:-1]), tokens[-1]


def _clamp(value: float) -> float:
    return min(1.0, max(0.0, float(value)))


def _score_confidence(
    fields: Mapping[str, str], *, derived_name: bool, unparsed_dates: int
) -> float:
    """Deterministic completeness score in [0.0, 1.0].

    ``1.0`` means every required field was present and every date parsed to
    ISO 8601. Each missing required field costs ``MISSING_FIELD_PENALTY``;
    a name recovered by splitting a single string costs
    ``DERIVED_NAME_PENALTY``; each unparsed date costs
    ``UNPARSED_DATE_PENALTY``.
    """
    missing = sum(1 for name in REQUIRED_FIELDS if not fields.get(name))
    score = 1.0 - (missing * MISSING_FIELD_PENALTY)
    if derived_name:
        score -= DERIVED_NAME_PENALTY
    score -= unparsed_dates * UNPARSED_DATE_PENALTY
    return round(_clamp(score), 4)


# --------------------------------------------------------------------------
# Mock extraction (the default path)
# --------------------------------------------------------------------------


def extract_identity_mock(document: Mapping[str, Any]) -> ExtractedIdentity:
    """Deterministic field mapper over a fixture document. No LLM, no I/O."""
    if not isinstance(document, Mapping):
        raise DocumentExtractionError(
            f"document must be a mapping, got {type(document).__name__}"
        )
    if not document:
        raise DocumentExtractionError("document is empty")

    values = {
        name: _as_text(_lookup(document, aliases))
        for name, aliases in _ALIASES.items()
        if name != "address"
    }

    derived_name = False
    if not values["first_name"] and not values["last_name"]:
        full_name = _as_text(_lookup(document, _FULL_NAME_ALIASES))
        if full_name:
            values["first_name"], values["last_name"] = _split_full_name(full_name)
            derived_name = True

    unparsed_dates = 0
    for field_name in ("date_of_birth", "document_expiry"):
        normalised, parsed = _normalise_date(values[field_name])
        values[field_name] = normalised
        if normalised and not parsed:
            unparsed_dates += 1

    values["nationality"] = _normalise_country(values["nationality"])
    values["document_type"] = _normalise_document_type(values["document_type"])

    address = _normalise_address(_lookup(document, _ALIASES["address"]))

    confidence = _score_confidence(
        values, derived_name=derived_name, unparsed_dates=unparsed_dates
    )
    declared = _lookup(document, ("extraction_confidence", "confidence"))
    if isinstance(declared, (int, float)):
        # A fixture that states its own confidence caps ours — it knows about
        # blur, glare, and partial scans that a field mapper cannot see.
        confidence = round(min(confidence, _clamp(declared)), 4)

    return ExtractedIdentity(
        first_name=values["first_name"],
        last_name=values["last_name"],
        date_of_birth=values["date_of_birth"],
        nationality=values["nationality"],
        document_type=values["document_type"],
        document_number=values["document_number"],
        document_expiry=values["document_expiry"],
        address=address,
        confidence=confidence,
    )


# --------------------------------------------------------------------------
# LLM extraction (opt-in, always falls back)
# --------------------------------------------------------------------------


_LLM_PROMPT = """You extract identity fields from a KYC document.

Return ONLY a JSON object with exactly these keys:
  first_name, last_name, date_of_birth, nationality, document_type,
  document_number, document_expiry, address, confidence

Rules:
- Dates must be ISO 8601 (YYYY-MM-DD). nationality must be an ISO 3166-1
  alpha-2 code. document_type must be lowercase snake_case.
- Use an empty string for any field the document does not contain.
  Never invent, complete, or guess a value.
- address may be null. confidence is your extraction confidence, 0.0-1.0.

Document:
```json
{document}
```
"""


def llm_enabled(use_llm: bool = False) -> bool:
    """LLM mode is on when the caller asks for it or ``USE_LLM`` is truthy."""
    if use_llm:
        return True
    return os.getenv("USE_LLM", "").strip().lower() in _TRUTHY


def _parse_llm_json(raw: str) -> dict[str, Any]:
    """Pull the JSON object out of a chat reply that may carry code fences."""
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in LLM response")
    payload = json.loads(text[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("LLM response was not a JSON object")
    return payload


def _merge_llm_payload(
    payload: Mapping[str, Any], baseline: ExtractedIdentity
) -> ExtractedIdentity:
    """Layer LLM output over the deterministic extraction.

    The LLM may *fill* fields the mapper left empty; it may not overwrite a
    field the mapper read straight out of the document, and its confidence
    can only lower the score.
    """
    merged: dict[str, str] = {}
    for name in REQUIRED_FIELDS:
        current = getattr(baseline, name)
        merged[name] = current or _as_text(payload.get(name))

    merged["nationality"] = _normalise_country(merged["nationality"])
    merged["document_type"] = _normalise_document_type(merged["document_type"])
    unparsed_dates = 0
    for field_name in ("date_of_birth", "document_expiry"):
        normalised, parsed = _normalise_date(merged[field_name])
        merged[field_name] = normalised
        if normalised and not parsed:
            unparsed_dates += 1

    address = baseline.address or _normalise_address(payload.get("address"))

    confidence = _score_confidence(
        merged, derived_name=False, unparsed_dates=unparsed_dates
    )
    declared = payload.get("confidence")
    if isinstance(declared, (int, float)):
        confidence = round(min(confidence, _clamp(declared)), 4)

    return ExtractedIdentity(
        address=address, confidence=confidence, **merged
    )


async def _extract_with_llm(
    document: Mapping[str, Any], baseline: ExtractedIdentity
) -> ExtractedIdentity:
    """Haystack ``OpenAIChatGenerator`` pass. Raises on any failure."""
    os.environ.setdefault("HAYSTACK_TELEMETRY_ENABLED", "false")
    from haystack.components.generators.chat import (  # type: ignore[import-untyped]
        OpenAIChatGenerator,
    )
    from haystack.dataclasses import ChatMessage  # type: ignore[import-untyped]

    generator = OpenAIChatGenerator(
        model=os.getenv("OPENAI_MODEL", DEFAULT_LLM_MODEL),
        generation_kwargs={"temperature": 0.0},
    )
    prompt = _LLM_PROMPT.format(document=json.dumps(document, indent=2, sort_keys=True))

    # Haystack generators are synchronous; keep the event loop free.
    result = await asyncio.to_thread(
        generator.run, messages=[ChatMessage.from_user(prompt)]
    )
    replies = result.get("replies") or []
    if not replies:
        raise ValueError("LLM returned no replies")
    return _merge_llm_payload(_parse_llm_json(replies[0].text), baseline)


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------


async def extract_identity(
    document: dict, use_llm: bool = False
) -> ExtractedIdentity:
    """Extract structured identity data from a customer ``document``.

    Args:
        document: A document fixture — either a flat extracted-document dict
            or a customer profile carrying ``id_document`` /
            ``extracted_fields`` (see the schema on issue #437).
        use_llm: Force LLM mode. Otherwise LLM mode turns on when
            ``USE_LLM`` is truthy and ``OPENAI_API_KEY`` is set.

    Returns:
        An :class:`ExtractedIdentity`. Missing fields come back empty and
        pull ``confidence`` down; they are never invented.

    Raises:
        DocumentExtractionError: The document is not a non-empty mapping.

    LLM failures (Haystack absent, no API key, bad response, network error)
    are logged and degrade to the mock extraction — never raised.
    """
    baseline = extract_identity_mock(document)

    if not llm_enabled(use_llm):
        return baseline

    if not os.getenv("OPENAI_API_KEY"):
        logger.warning(
            "LLM mode requested but OPENAI_API_KEY is unset; using mock extraction."
        )
        return baseline

    try:
        return await _extract_with_llm(document, baseline)
    except ImportError:
        logger.warning(
            "LLM mode requested but haystack-ai is not installed "
            "(pip install 'haystack-ai>=2.21'); using mock extraction."
        )
    except Exception as exc:  # pragma: no cover - depends on a live provider
        logger.warning("LLM extraction failed (%s); using mock extraction.", exc)
    return baseline


def load_document(reference: str | Path) -> dict:
    """Load a document fixture by path, or by id from ``fixtures/documents/``.

    ``load_document("document-001")`` and
    ``load_document("/abs/path/doc.json")`` both work. The id form resolves
    against the fixtures produced by sub-issue #437.
    """
    path = Path(reference)
    if not path.exists() and not path.is_absolute():
        candidate = FIXTURES_DIR / path.name
        if candidate.suffix != ".json":
            candidate = candidate.with_suffix(".json")
        path = candidate
    if not path.exists():
        raise DocumentExtractionError(f"document fixture not found: {reference}")
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise DocumentExtractionError(f"document fixture is not a JSON object: {path}")
    return payload

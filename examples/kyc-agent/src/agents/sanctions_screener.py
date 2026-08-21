"""Sanctions Screening Agent (sub-issue #439 / KYC #4).

Screens a customer against synthetic OFAC / EU / UN sanctions fixtures using
local fuzzy name matching. No external API, no API key, no network.

Design invariants (mirrors the Decision Agent, #441):

1. **Deterministic.** ``difflib.SequenceMatcher`` over normalised names, with
   a documented, versioned threshold table. Same inputs → same result.
2. **A name alone is never an exact match.** ``exact_match`` requires a
   near-identical name *and* corroborating date of birth. Everything else
   that clears the name threshold is ``near_match`` — a human decides.
3. **Screening never clears on missing data.** An unknown date of birth or
   nationality cannot upgrade a match to exact, but it also cannot dismiss
   one; it lands in ``near_match`` with the uncertainty priced into the
   confidence.
4. **Aliases are first-class.** The best score across the primary name and
   every alias wins, because a sanctioned party's alias is the name they
   apply with.

Boundary: this agent is a pure function over its inputs and the fixture
list. Wrap it with TealTiger governance at the caller (PII scan on the
query, receipt on the ``SanctionsResult``). Do not embed governance here.
"""
from __future__ import annotations

import functools
import json
import logging
import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

try:  # relative import when used as a package (e.g. from #435 scaffold)
    from ..interfaces import SanctionsResult
except ImportError:  # fallback for direct src/ sys.path usage in tests
    from interfaces import SanctionsResult  # type: ignore[no-redef]

logger = logging.getLogger(__name__)

SCREENER_VERSION = "kyc-sanctions-screener/v1.0.0"

_EXAMPLE_ROOT = Path(__file__).resolve().parents[2]

#: Canonical fixture produced by sub-issue #437.
SANCTIONS_FIXTURE = _EXAMPLE_ROOT / "fixtures" / "sanctions_list.json"

#: Bundled fallback so #439 runs before #437 merges.
BUNDLED_SANCTIONS_FIXTURE = (
    _EXAMPLE_ROOT / "tests" / "fixtures" / "sanctions_list.json"
)

#: Name similarity at or above which a customer is worth reporting at all.
DEFAULT_MATCH_THRESHOLD = 0.85

#: Name similarity required before a corroborated hit can be called exact.
DEFAULT_EXACT_THRESHOLD = 0.95

#: Confidence weighting for a reported hit. Change → bump SCREENER_VERSION.
NAME_WEIGHT = 0.7
CORROBORATION_WEIGHT = 0.3

#: Corroboration score used when nothing about the entry can be checked.
UNKNOWN_CORROBORATION = 0.5

_KNOWN_LIST_SOURCES = {
    "ofac": "OFAC_SDN",
    "ofac_sdn": "OFAC_SDN",
    "sdn": "OFAC_SDN",
    "eu": "EU_SANCTIONS",
    "eu_sanctions": "EU_SANCTIONS",
    "eu_cfsp": "EU_SANCTIONS",
    "un": "UN_SANCTIONS",
    "un_sanctions": "UN_SANCTIONS",
    "unsc": "UN_SANCTIONS",
}

_NAME_ALIASES = ("name", "full_name", "entity_name", "primary_name")
_ALIAS_ALIASES = ("aliases", "aka", "also_known_as", "alt_names")
_DOB_ALIASES = ("date_of_birth", "dob", "birth_date")
_NATIONALITY_ALIASES = ("nationality", "country", "citizenship", "country_of_birth")
_SOURCE_ALIASES = ("list_source", "list", "source", "program", "sanctions_list")
_ENTRIES_ALIASES = ("entries", "entities", "sanctions", "records", "list")

#: Honorifics and corporate suffixes that carry no identifying signal.
_NOISE_TOKENS = frozenset(
    {"mr", "mrs", "ms", "miss", "dr", "sir", "the", "ltd", "llc", "inc", "sa", "plc"}
)


class SanctionsScreeningError(ValueError):
    """Raised when the sanctions list cannot be read or is malformed."""


# --------------------------------------------------------------------------
# Normalisation (pure)
# --------------------------------------------------------------------------


def _as_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return ""


def normalise_name(name: str) -> str:
    """Casefold, strip accents and punctuation, collapse whitespace.

    ``"Ivan  Testóvich-Fixture, Mr."`` → ``"ivan testovich fixture"``. Noise
    tokens (honorifics, corporate suffixes) are dropped so they cannot pad a
    similarity score.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-z0-9\s]", " ", ascii_only.lower())
    tokens = [token for token in cleaned.split() if token not in _NOISE_TOKENS]
    return " ".join(tokens)


def _ratio(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()


def name_similarity(query: str, candidate: str) -> float:
    """Similarity in [0.0, 1.0], order-insensitive.

    Scored twice — as written and with tokens sorted — so ``"Smith Jane"``
    and ``"Jane Smith"`` are the same person, which is how name fields
    actually arrive from different jurisdictions.
    """
    left, right = normalise_name(query), normalise_name(candidate)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    sorted_left = " ".join(sorted(left.split()))
    sorted_right = " ".join(sorted(right.split()))
    return round(max(_ratio(left, right), _ratio(sorted_left, sorted_right)), 4)


def _normalise_list_source(value: str) -> Optional[str]:
    text = _as_text(value)
    if not text:
        return None
    key = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return _KNOWN_LIST_SOURCES.get(key, text)


def _first(entry: Mapping[str, Any], names: tuple[str, ...]) -> Any:
    for name in names:
        if name in entry and entry[name] not in (None, "", [], {}):
            return entry[name]
    return None


def _entry_aliases(entry: Mapping[str, Any]) -> tuple[str, ...]:
    raw = _first(entry, _ALIAS_ALIASES)
    if isinstance(raw, str):
        return (raw,)
    if isinstance(raw, Sequence):
        return tuple(_as_text(item) for item in raw if _as_text(item))
    return ()


def _dob_signal(query_dob: str, entry_dob: str) -> Optional[float]:
    """1.0 same date, 0.5 same year, 0.0 conflict, ``None`` unknown."""
    left, right = _as_text(query_dob), _as_text(entry_dob)
    if not left or not right:
        return None
    if left == right:
        return 1.0
    if left[:4] == right[:4] and len(left) >= 4 and len(right) >= 4:
        return 0.5
    return 0.0


def _nationality_signal(query_nat: str, entry_nat: str) -> Optional[float]:
    left, right = _as_text(query_nat).upper(), _as_text(entry_nat).upper()
    if not left or not right:
        return None
    return 1.0 if left == right else 0.0


def _corroboration(signals: Iterable[Optional[float]]) -> tuple[float, bool]:
    """Mean of the known signals, plus whether anything was checkable."""
    known = [signal for signal in signals if signal is not None]
    if not known:
        return UNKNOWN_CORROBORATION, False
    return sum(known) / len(known), True


# --------------------------------------------------------------------------
# Fixture loading
# --------------------------------------------------------------------------


def _coerce_entries(payload: Any, default_source: Optional[str]) -> list[dict[str, Any]]:
    if isinstance(payload, Mapping):
        source = _normalise_list_source(_as_text(_first(payload, _SOURCE_ALIASES) or ""))
        nested = _first(payload, _ENTRIES_ALIASES)
        if not isinstance(nested, (list, tuple)):
            # A single entry object (``list`` doubles as a source spelling).
            return _coerce_entries([payload], source or default_source)
        return _coerce_entries(nested, source or default_source)

    if not isinstance(payload, Sequence) or isinstance(payload, (str, bytes)):
        raise SanctionsScreeningError("sanctions list must be a JSON array or object")

    entries: list[dict[str, Any]] = []
    for raw in payload:
        if not isinstance(raw, Mapping):
            raise SanctionsScreeningError("sanctions entry must be a JSON object")
        name = _as_text(_first(raw, _NAME_ALIASES))
        if not name:
            continue  # an unnamed entry cannot be screened against
        entries.append(
            {
                "id": _as_text(raw.get("id")),
                "name": name,
                "aliases": _entry_aliases(raw),
                "date_of_birth": _as_text(_first(raw, _DOB_ALIASES)),
                "nationality": _as_text(_first(raw, _NATIONALITY_ALIASES)),
                "list_source": _normalise_list_source(
                    _as_text(_first(raw, _SOURCE_ALIASES) or "")
                )
                or default_source,
            }
        )
    return entries


def load_sanctions_list(path: str | Path | None = None) -> list[dict[str, Any]]:
    """Load and normalise a sanctions fixture.

    With no argument it prefers the canonical ``fixtures/sanctions_list.json``
    from sub-issue #437 and falls back to the synthetic list bundled with this
    agent's tests, so screening works before #437 merges.

    Accepts a top-level array, ``{"entries": [...]}``, or any of the common
    key spellings (``entities``, ``sanctions``, ``records``), and tolerates
    per-entry aliases (``aka``, ``country``, ``dob``, …).
    """
    if path is None:
        path = SANCTIONS_FIXTURE if SANCTIONS_FIXTURE.exists() else BUNDLED_SANCTIONS_FIXTURE
    resolved = Path(path)
    if not resolved.exists():
        raise SanctionsScreeningError(f"sanctions list not found: {resolved}")
    try:
        with resolved.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise SanctionsScreeningError(f"sanctions list is not valid JSON: {resolved}") from exc
    return _coerce_entries(payload, default_source=None)


@functools.lru_cache(maxsize=4)
def _cached_list(path: Optional[str]) -> tuple[dict[str, Any], ...]:
    return tuple(load_sanctions_list(path))


# --------------------------------------------------------------------------
# Screening
# --------------------------------------------------------------------------


def _score_entry(
    name: str, dob: str, nationality: str, entry: Mapping[str, Any]
) -> tuple[float, str, float, bool]:
    """Return ``(name_score, matched_name, corroboration, corroborated)``."""
    candidates = (entry["name"], *entry["aliases"])
    name_score, matched_name = max(
        ((name_similarity(name, candidate), candidate) for candidate in candidates),
        key=lambda pair: pair[0],
    )
    corroboration, checkable = _corroboration(
        (
            _dob_signal(dob, entry["date_of_birth"]),
            _nationality_signal(nationality, entry["nationality"]),
        )
    )
    return name_score, matched_name, corroboration, checkable


async def screen_sanctions(
    name: str,
    dob: str = "",
    nationality: str = "",
    *,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
    exact_threshold: float = DEFAULT_EXACT_THRESHOLD,
    sanctions_list: Optional[Sequence[Mapping[str, Any]]] = None,
    list_path: str | Path | None = None,
) -> SanctionsResult:
    """Screen a customer against the sanctions fixtures.

    Args:
        name: Full name as supplied by the customer or the extractor (#438).
        dob: ISO 8601 date of birth. Optional — absence cannot clear a hit.
        nationality: ISO 3166-1 alpha-2 code. Optional, same rule.
        threshold: Name similarity at or above which a hit is reported.
            Default ``0.85``.
        exact_threshold: Name similarity required before a date-of-birth
            corroborated hit is called ``exact_match``. Default ``0.95``.
        sanctions_list: Inject entries directly (tests, or a caller that has
            already loaded a list). Skips fixture loading entirely.
        list_path: Load a specific fixture instead of the default.

    Returns:
        A :class:`SanctionsResult`. ``status`` is ``clear``, ``near_match``
        or ``exact_match``; ``confidence`` is confidence in *that verdict*,
        not raw name similarity.

    Raises:
        SanctionsScreeningError: The name is empty, or the list is unreadable.
    """
    if not _as_text(name):
        raise SanctionsScreeningError("name is required for sanctions screening")
    if not 0.0 <= threshold <= exact_threshold <= 1.0:
        raise SanctionsScreeningError(
            "thresholds must satisfy 0 <= threshold <= exact_threshold <= 1"
        )

    if sanctions_list is not None:
        entries: Sequence[Mapping[str, Any]] = _coerce_entries(
            list(sanctions_list), default_source=None
        )
    else:
        entries = _cached_list(str(list_path) if list_path is not None else None)

    best_score = 0.0
    best: Optional[dict[str, Any]] = None
    for entry in entries:
        score, matched_name, corroboration, checkable = _score_entry(
            name, dob, nationality, entry
        )
        if score > best_score:
            best_score = score
            best = {
                "entry": entry,
                "matched_name": matched_name,
                "corroboration": corroboration,
                "checkable": checkable,
            }

    if best is None or best_score < threshold:
        # Nothing resembles the customer. Confidence in "clear" is the
        # distance from the closest thing on the list.
        return SanctionsResult(
            status="clear",
            confidence=round(1.0 - best_score, 4),
            matched_entity=None,
            list_source=None,
        )

    dob_signal = _dob_signal(dob, best["entry"]["date_of_birth"])
    # A name alone never confirms a person: exact_match needs the date of
    # birth to agree. Anything else is a human's call.
    is_exact = best_score >= exact_threshold and dob_signal == 1.0

    confidence = round(
        min(
            1.0,
            NAME_WEIGHT * best_score + CORROBORATION_WEIGHT * best["corroboration"],
        ),
        4,
    )

    return SanctionsResult(
        status="exact_match" if is_exact else "near_match",
        confidence=confidence,
        matched_entity=best["entry"]["name"],
        list_source=best["entry"]["list_source"],
    )

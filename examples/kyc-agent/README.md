# KYC Agent — Document Extraction (#438), Sanctions Screening (#439) + Deterministic Decision Agent (#441)

> **Scope.** This directory currently contains the **Document Extraction Agent** (`#438`), the **Sanctions Screening Agent** (`#439`) and the **Decision Agent** (`#441`), plus their type dependencies. It slots into the full `examples/kyc-agent/` scaffold produced by `#435`, and will consume the fixtures from `#437` and the risk output from `#440` as those land.

## What is here

```
examples/kyc-agent/
├── README.md                       ← this file
├── src/
│   ├── __init__.py
│   ├── interfaces/
│   │   ├── __init__.py
│   │   └── kyc_types.py            ← ExtractedIdentity (#438), SanctionsResult (#439), KYCDecision (#441)
│   └── agents/
│       ├── __init__.py
│       ├── document_extractor.py   ← extract_identity() — mock + optional Haystack LLM
│       ├── sanctions_screener.py   ← screen_sanctions() — local fuzzy matching
│       └── decision_agent.py       ← the deterministic make_decision() implementation
└── tests/
    ├── __init__.py
    ├── fixtures/documents/         ← 7 synthetic documents covering the edge cases
    ├── fixtures/sanctions_list.json ← 20 synthetic OFAC/EU/UN entries
    ├── test_document_extractor.py  ← pytest suite (39 cases, all offline)
    ├── test_sanctions_screener.py  ← pytest suite (35 cases, all offline)
    └── test_decision_agent.py      ← pytest suite (17 cases, all deterministic)
```

The **stub** left in `src/interfaces/kyc_types.py` (`RiskAssessment`) will be **deleted** from this directory the moment the canonical version lands from sub-issue `#440` (risk scoring). `ExtractedIdentity` (`#438`), `SanctionsResult` (`#439`) and `KYCDecision` (`#441`) are canonical and match the interfaces published on those issues.

## Document Extraction Agent (`#438`)

`extract_identity(document, use_llm=False)` turns a document fixture (a JSON
`dict`, not an image) into an `ExtractedIdentity`.

```python
import asyncio
from agents.document_extractor import extract_identity, load_document

document = load_document("tests/fixtures/documents/passport-complete.json")
identity = asyncio.run(extract_identity(document))

identity.first_name       # "Jane"
identity.date_of_birth    # "1985-03-15"  (normalised to ISO 8601)
identity.document_type    # "passport"    (normalised to snake_case)
identity.confidence       # 1.0
```

### Two modes

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Mock** (default) | nothing to set | Pure deterministic field mapper over the fixture JSON. No LLM, no network, no keys. |
| **LLM** (opt-in) | `use_llm=True`, or `USE_LLM=true` + `OPENAI_API_KEY` | Haystack `OpenAIChatGenerator` reads the document, then its output is merged *under* the deterministic extraction. |

LLM mode **always degrades to mock mode** — a missing `haystack-ai`, an absent
API key, a malformed reply, or a network failure is logged and falls back. The
example never stops working offline. Install the optional dependency with
`pip install 'haystack-ai>=2.21'`.

### Extraction invariants

1. **Never invent a value.** A field absent from the document comes back as
   `""`, not as a plausible-looking string. Wrong-but-confident identity data
   is the failure mode that costs banks fines.
2. **Never guess an ambiguous date.** `03/04/1985` could be 3 April or 4 March;
   it is returned verbatim and costs confidence. Only unambiguous forms
   (`YYYY-MM-DD`, `YYYY/MM/DD`, `DD Mon YYYY`, `Mon DD, YYYY`, and `DD/MM/YYYY`
   where the first component exceeds 12) are normalised to ISO 8601.
3. **Confidence is computed, not guessed.** It comes from a versioned scoring
   table, so a partial extraction can never report `1.0` — the Decision Agent
   uses that number as an escalation trigger.
4. **The LLM can only fill gaps and lower confidence.** It cannot overwrite a
   field read straight out of the document, and a declared confidence caps the
   computed score rather than raising it.

### Confidence scoring (`kyc-document-extractor/v1.0.0`)

```
score = 1.0
      - 0.15 per missing required field   (first_name, last_name, date_of_birth,
                                           nationality, document_type,
                                           document_number, document_expiry)
      - 0.05 if the name was recovered by splitting a single full-name string
      - 0.05 per date that could not be normalised to ISO 8601
      clamped to [0.0, 1.0], rounded to 4 decimals

A `confidence` / `extraction_confidence` declared on the document caps the
result — a scanner that saw the blur knows more than a field mapper does.
```

### Accepted document shapes

Fields are resolved from `extracted_fields` → `id_document` → the document
root, so both the flat document fixtures and the customer-profile schema from
`#437` work unchanged. Common aliases are accepted (`given_name`/`surname`,
`dob`, `issuing_country`, `id_number`, `expiry`, …), and an address supplied as
a mapping is flattened to one display line.

The fixtures under `tests/fixtures/documents/` are self-contained and fully
synthetic (country `ZZ`, `TEST`-prefixed document numbers) so `#438` does not
depend on `#437` merging first. When `#437` lands, `load_document("document-001")`
resolves ids against `fixtures/documents/` too.

## Sanctions Screening Agent (`#439`)

`screen_sanctions(name, dob, nationality)` matches a customer against the
synthetic OFAC / EU / UN fixtures with local fuzzy matching — `difflib`, no
external API, no key.

```python
import asyncio
from agents.sanctions_screener import screen_sanctions

result = asyncio.run(screen_sanctions("Ivan Testovich Fixture", "1961-02-02", "ZZ"))

result.status          # "exact_match"
result.confidence      # 1.0
result.matched_entity  # "Ivan Testovich Fixture"
result.list_source     # "OFAC_SDN"
```

### Verdicts

| Status | When | `confidence` means |
|--------|------|--------------------|
| `clear` | best name similarity < `threshold` (default `0.85`) | distance from the closest entry on the list — high when nothing resembles the customer |
| `near_match` | name clears the threshold, but the date of birth does not corroborate it | how strong the reported hit is |
| `exact_match` | name similarity ≥ `exact_threshold` (default `0.95`) **and** the date of birth matches | same |

### Screening invariants

1. **A name alone never confirms a person.** `exact_match` requires the date
   of birth to agree. A perfect name with no DOB supplied is a `near_match` —
   a human decides. This is the difference between a screening hit and an
   accusation.
2. **Missing data never clears a hit.** An unknown DOB or nationality cannot
   upgrade a match to exact, and it cannot dismiss one either; it lands in
   `near_match` with the uncertainty priced into the confidence.
3. **Aliases are first-class.** The best score across the primary name and
   every alias wins — a sanctioned party's alias is the name they apply with.
   The result always reports the *primary* entity name, not the alias that hit.
4. **Names are compared order-insensitively.** `"Fixture Testovich Ivan"`,
   `"Mr. Ivan Testovich Fixture"` and `"ÍVAN TESTÓVICH FIXTURE"` are the same
   person: accents are stripped, honorifics and corporate suffixes dropped,
   and every pair is scored both as written and token-sorted.

### Confidence scoring (`kyc-sanctions-screener/v1.0.0`)

```
name_score  = best difflib similarity across the entry's name + aliases
dob_signal  = 1.0 same date · 0.5 same year · 0.0 conflict · unknown if absent
nat_signal  = 1.0 match · 0.0 conflict · unknown if absent

clear                  -> confidence = 1.0 - name_score
near_match/exact_match -> confidence = 0.7 * name_score
                                     + 0.3 * mean(known signals, else 0.5)
```

### Sanctions fixture

`load_sanctions_list()` prefers the canonical `fixtures/sanctions_list.json`
from `#437` and falls back to the synthetic list bundled at
`tests/fixtures/sanctions_list.json`, so `#439` runs before `#437` merges. The
loader accepts a top-level array, `{"entries": [...]}`, and the common key
spellings (`entities`, `sanctions`, `records`, `aka`, `dob`, `country`, …), so
whichever shape `#437` ships works unchanged.

The bundled list is entirely synthetic — 20 obviously fake people and
companies (`Ivan Testovich Fixture`, `Synthetic Holdings Ltd`) on user-assigned
country codes `ZZ`/`QQ`/`XX`. **No real sanctioned person, entity, programme or
country is represented anywhere in this repository.**

## Decision Agent design (Quesen shape)

The decision function follows Quesen's Deterministic Trust Infrastructure invariants:

1. **Same input, same decision.** No LLM in the scoring loop. Every input is canonicalised and hashed; the hash appears in the audit record.
2. **Versioned policy.** The threshold table and weighting scheme are stamped as `policy_version` on every `KYCDecision`. Changing a threshold requires a version bump.
3. **Audit as replay.** The `audit_record` is a self-contained proof: given `(inputs_hash, policy_version)` the exact same `KYCDecision` can be reconstructed by re-running the policy.
4. **Sanctions is a veto.** Even a low composite risk score cannot approve a case with an exact sanctions match. Sanctions status maps to hard rules before the score band is checked.
5. **Explicit escalation reasons.** `escalation_reason` is never a generic string; it enumerates which invariants pushed the decision into human review.

## Decision policy (v1)

```
composite = 0.6 * sanctions_signal + 0.4 * risk_signal

sanctions_signal:
  "clear"        -> 0.0
  "near_match"   -> 0.6
  "exact_match"  -> 1.0

risk_signal:
  min(1.0, max(0.0, RiskAssessment.risk_score))

decision (per issue #441):
  composite < 0.4                       -> approve
  0.4 <= composite <= 0.8               -> escalate
  composite > 0.8                       -> reject

hard overrides (applied AFTER threshold):
  sanctions.status == "exact_match"     -> reject   (regardless of composite)
  sanctions.status == "near_match"      -> escalate (regardless of composite, if band was approve)
  identity.confidence < 0.5             -> escalate (identity uncertainty)
```

## Governance boundary

The `make_decision` call itself is a pure deterministic function. It is intended to be **wrapped** at the boundary by TealTiger governance (PII scan on inputs before, audit-trail emit on outputs after). Nothing about this file bypasses or duplicates governance — it produces a stable decision surface for TealTiger to govern, exactly as discussed on `#434` ([comment](https://github.com/agentguard-ai/tealtiger/issues/434#issuecomment-5160027792)).

## Running the tests

```bash
cd examples/kyc-agent
python -m pytest tests/ -v
```

No external dependencies; no API keys; no network calls; no LLM. All three
suites — `test_document_extractor.py`, `test_sanctions_screener.py` and
`test_decision_agent.py` — run offline and deterministically.

## Follow-ups after this PR merges

1. **On `#435` merge:** move `src/interfaces/kyc_types.py` to the canonical location and re-import.
2. **On `#440` merge:** replace the `RiskAssessment` stub with the real one; adjust test fixtures.
3. **On `#437` merge:** point `extract_identity` at `fixtures/documents/` and drop the bundled sanctions fallback in favour of `fixtures/sanctions_list.json`.
4. **On `#443` merge:** add a TealTiger governance wrapper (PII scan on the raw document and on the screening query, receipt on every agent output) for the reference implementation walkthrough.
5. **On `#445` merge:** wire `extract_identity` → `screen_sanctions` → `score_risk` → `make_decision` into the orchestrator.

---

*Decision Agent (`#441`) authored by Senueren under the Quesen bureau, per `sib-bureau-external-affairs` doctrine §21 (Active Engagement). Document Extraction Agent (`#438`) and Sanctions Screening Agent (`#439`) added on top of it.*

# KYC Agent — Document Extraction (#438) + Deterministic Decision Agent (#441)

> **Scope.** This directory currently contains the **Document Extraction Agent** (`#438`) and the **Decision Agent** (`#441`), plus their type dependencies. It slots into the full `examples/kyc-agent/` scaffold produced by `#435`, and will consume the fixtures from `#437` and the sanctions/risk outputs from `#439`/`#440` as those land.

## What is here

```
examples/kyc-agent/
├── README.md                       ← this file
├── src/
│   ├── __init__.py
│   ├── interfaces/
│   │   ├── __init__.py
│   │   └── kyc_types.py            ← ExtractedIdentity (#438) + KYCDecision (#441)
│   └── agents/
│       ├── __init__.py
│       ├── document_extractor.py   ← extract_identity() — mock + optional Haystack LLM
│       └── decision_agent.py       ← the deterministic make_decision() implementation
└── tests/
    ├── __init__.py
    ├── fixtures/documents/         ← 7 synthetic documents covering the edge cases
    ├── test_document_extractor.py  ← pytest suite (39 cases, all offline)
    └── test_decision_agent.py      ← pytest suite (17 cases, all deterministic)
```

**Types marked as stubs** in `src/interfaces/kyc_types.py` (`SanctionsResult`, `RiskAssessment`) will be **deleted** from this directory the moment the canonical versions land from sub-issues `#439` (sanctions) and `#440` (risk scoring). `ExtractedIdentity` is now **canonical** per `#438` and matches the interface published on that issue; `KYCDecision` is canonical per `#441`.

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

## Decision Agent design (Quesen shape)

The decision function follows Quesen's Deterministic Trust Infrastructure invariants:

1. **Same input, same decision.** No LLM in the scoring loop. Every input is canonicalised and hashed; the hash appears in the audit record.
2. **Versioned policy.** The threshold table and weighting scheme are stamped as `policy_version` on every `KYCDecision`. Changing a threshold requires a version bump.
3. **Audit as replay.** The `audit_record` is a self-contained proof: given `(inputs_hash, policy_version)` the exact same `KYCDecision` can be reconstructed by re-running the policy.
4. **Sanctions is a veto.** Even a low composite risk score cannot approve a case with a confirmed sanctions match. Sanctions status maps to hard rules before the score band is checked.
5. **Explicit escalation reasons.** `escalation_reason` is never a generic string; it enumerates which invariants pushed the decision into human review.

## Decision policy (v1)

```
composite = 0.6 * sanctions_signal + 0.4 * risk_signal

sanctions_signal:
  "clear"        -> 0.0
  "near_match"   -> 0.6
  "confirmed"    -> 1.0

risk_signal:
  min(1.0, max(0.0, RiskAssessment.risk_score))

decision (per issue #441):
  composite < 0.4                       -> approve
  0.4 <= composite <= 0.8               -> escalate
  composite > 0.8                       -> reject

hard overrides (applied AFTER threshold):
  sanctions.status == "confirmed"       -> reject   (regardless of composite)
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

No external dependencies; no API keys; no network calls; no LLM. Everything in
`tests/test_document_extractor.py` and `tests/test_decision_agent.py` runs
offline and deterministically.

## Follow-ups after this PR merges

1. **On `#435` merge:** move `src/interfaces/kyc_types.py` to the canonical location and re-import.
2. **On `#439` merge:** replace the `SanctionsResult` stub with the real one; adjust test fixtures.
3. **On `#440` merge:** same for `RiskAssessment`.
4. **On `#437` merge:** point `extract_identity` at `fixtures/documents/` and add a fixture-driven case sweep to both test suites.
5. **On `#443` merge:** add a TealTiger governance wrapper (PII scan on the raw document, receipt on the `ExtractedIdentity` and the `KYCDecision`) for the reference implementation walkthrough.
6. **On `#445` merge:** wire `extract_identity` → `screen_sanctions` → `score_risk` → `make_decision` into the orchestrator.

---

*Decision Agent (`#441`) authored by Senueren under the Quesen bureau, per `sib-bureau-external-affairs` doctrine §21 (Active Engagement). Document Extraction Agent (`#438`) added on top of it.*

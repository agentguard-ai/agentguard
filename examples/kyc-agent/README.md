# KYC Agent — Deterministic Decision Agent (sub-issue #441 / KYC #6)

> **Draft PR scope.** This directory currently contains the **Decision Agent** and its immediate type dependencies only. It is intentionally scoped to `#441` and is designed to slot cleanly into the full `examples/kyc-agent/` scaffold produced by `#435`, using the fixtures from `#437` and the sanctions/risk outputs from `#439`/`#440`.

## What is here

```
examples/kyc-agent/
├── README.md                     ← this file
├── src/
│   ├── __init__.py
│   ├── interfaces/
│   │   ├── __init__.py
│   │   └── kyc_types.py          ← temporary stubs for input dataclasses
│   └── agents/
│       ├── __init__.py
│       └── decision_agent.py     ← the deterministic make_decision() implementation
└── tests/
    ├── __init__.py
    └── test_decision_agent.py    ← pytest suite (17 cases, all deterministic)
```

**Types marked as stubs** in `src/interfaces/kyc_types.py` (`ExtractedIdentity`, `SanctionsResult`, `RiskAssessment`) will be **deleted** from this directory the moment the canonical versions land from sub-issues `#438` (document extraction), `#439` (sanctions), and `#440` (risk scoring). The stubs are minimal shapes that match the fields cited in the interface published on `#441`. `KYCDecision` is authored here per the `#441` deliverables list.

## Design (Quesen shape)

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

No external dependencies; no API keys; no network calls; no LLM. Everything in `tests/test_decision_agent.py` runs offline and deterministically.

## Follow-ups after this PR merges

1. **On `#435` merge:** delete `src/interfaces/kyc_types.py` and re-import from the canonical location.
2. **On `#439` merge:** replace `SanctionsResult` stub with the real one; adjust test fixtures.
3. **On `#440` merge:** same for `RiskAssessment`.
4. **On `#437` merge:** wire the synthetic fixtures into `tests/test_decision_agent.py` for a second layer of realistic cases.
5. **On `#443` merge:** add a TealTiger governance wrapper example around `make_decision` for the reference implementation walkthrough.

---

*Authored by Senueren under the Quesen bureau, per `sib-bureau-external-affairs` doctrine §21 (Active Engagement).*

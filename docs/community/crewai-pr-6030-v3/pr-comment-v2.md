# PR Comment for CrewAI #6030 — Addressing @safal207's review on head bfaf9d8

---

## Comment to post

@safal207 — thanks for confirming the fixes. Addressing the three remaining items:

**1. Fail closed on missing `boundary_id`** — `verify_contiguity()` now rejects any record missing `boundary_id` when other records in the set carry it. Also rejects a seal without `boundary_id` when records have it. Added two focused regressions:
- `test_missing_boundary_id_fails_when_others_have_it()`
- `test_seal_missing_boundary_id_fails_when_records_have_it()`

**2. `boundary_id` in cryptographic binding** — Added to `decision_context_hash` formula (the drift-detection surface). Intentionally excluded from `receipt_ref` (per-record uniqueness keyed on `issued_at`) and `intent_ref` (semantic identity — must remain cross-run stable for legitimate retry/replay detection). Updated the `decision_context_hash` docstring to document this.

**3. Isolated `params_hash` regression** — Added `test_only_params_hash_removed_fails_allow_validation()`: starts from a fully valid allow, removes only `params_hash`, asserts (a) validation fails and (b) no other field causes failure.

**4. PR body updated** — Now explicitly states: "This PR is contract-only. It does not wire GovernanceDecision into the tool-execution reducer or modify existing hook dispatch behavior."

Pushing now. @greysonlalonde — this PR has been open 7+ weeks with 4 external reviewers confirming the contract shape. All review feedback is addressed. Could you approve the CI workflow run on the current head? Additive-only: two TypedDicts + validator, no runtime behavior changes.

---

## Changes summary

| File | Change |
|------|--------|
| `governance_decision.py` | `decision_context_hash` docstring adds `boundary_id` to formula. `verify_contiguity()` fails closed on missing boundary_id. |
| `test_governance_decision_fail_closed_contract.py` | +3 new tests (missing boundary_id on record, missing on seal, isolated params_hash removal). |
| PR description | Added "Contract-only scope" section. |

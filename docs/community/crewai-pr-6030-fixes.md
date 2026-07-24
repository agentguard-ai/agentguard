# CrewAI PR #6030 — Fixes for @safal207 review (head 2f06bae)

## Fix 1: Module docstring — clarify contract-only scope

In `lib/crewai/src/crewai/governance/governance_decision.py`, change the opening docstring from:

```python
"""
GovernanceDecision -- Vendor-neutral governance hook return type for CrewAI.

This module defines the serialized contract that crew-level governance hooks
(before_tool_call / after_tool_call) can optionally return.
```

To:

```python
"""
GovernanceDecision -- Vendor-neutral governance contract types for CrewAI.

This module defines the serialized contract shape for governance authorization
records. A future reducer integration will consume these types from
before_tool_call / after_tool_call hooks; this PR establishes the wire format
only. External governance engines (TealTiger, Neura Relay, Vaara, agent-guard,
AlgoVoi, etc.) implement this contract without requiring CrewAI to depend on
any vendor package.
```

## Fix 2: Unknown verdict rejection in validator

In `validate_governance_decision()`, add this check right after the `if not decision:` block:

```python
    # Reject unknown verdicts — fail closed on unrecognized decision routes
    valid_verdicts = {"allow", "deny", "require_approval", "revise"}
    if decision not in valid_verdicts:
        errors.append(
            f"Unknown decision '{decision}' — must be one of: {sorted(valid_verdicts)}"
        )
        return (False, errors)
```

## Fix 3: Add `params_hash` to required fields for allow and require_approval

In the `allow` route required list, add `"params_hash"`:

```python
        required = [
            "agent_id", "tool", "normalized_scope", "normalization_id",
            "intent_digest", "intent_ref", "idempotency_key",
            "params_hash", "issued_at",
        ]
```

Same for `require_approval`:

```python
        required = [
            "agent_id", "tool", "normalized_scope", "normalization_id",
            "intent_digest", "intent_ref", "idempotency_key",
            "params_hash", "issued_at",
            "continuation_id", "expires_at",
        ]
```

## Fix 4: Fix stale intent_ref formula in test comment

In `lib/crewai/tests/governance/test_governance_decision_contract.py`, find the test `test_intent_ref_stable_across_retries` and update the docstring/comment from:

```python
    intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest,
                             idempotency_key}))
```

To:

```python
    intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))
    Note: idempotency_key is explicitly EXCLUDED from intent_ref computation.
    Duplicate enforcement uses the pair (intent_ref, idempotency_key).
```

## Fix 5: Add negative fixture for unknown verdict

In `lib/crewai/tests/governance/test_governance_decision_contract.py`, add:

```python
def test_unknown_verdict_fails_validation() -> None:
    """Unknown decision values must fail closed — not silently validate."""
    from crewai.governance.governance_decision import validate_governance_decision

    invalid_decisions = [
        {"decision_id": "d-bad-1", "decision": "approve"},
        {"decision_id": "d-bad-2", "decision": "ALLOW"},
        {"decision_id": "d-bad-3", "decision": "permit"},
        {"decision_id": "d-bad-4", "decision": ""},
    ]

    for d in invalid_decisions:
        is_valid, errors = validate_governance_decision(d)
        assert not is_valid, f"Expected invalid for decision='{d['decision']}'"
        assert any("Unknown decision" in e or "'decision' field is required" in e for e in errors)
```

---

## Comment to post on the PR

```
@safal207 — addressing all three points in this push:

**P0 (verdict disconnected from execution):** You're right — the reducer doesn't consume this dict yet. Updated the module docstring to explicitly state this is **contract-only** — it defines the wire format that a future reducer integration will consume. No false claim of current runtime enforcement.

**Unknown verdicts validate:** Added an explicit reject for values outside `{allow, deny, require_approval, revise}` + fixture for `decision="approve"`, `"ALLOW"`, and `"permit"`.

**Identity formula contradiction:** Fixed the stale test comment to match the normative formula: `intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))` — `idempotency_key` excluded.

**Bonus (from previous round):** Added `params_hash` to the required binding fields for both `allow` and `require_approval` routes.

Pushing now. This PR is contract-only — additive types, no runtime changes, no behavioral changes to existing hooks. Ready for maintainer CI approval.
```

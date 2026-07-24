# Issue Title

P0: Versioned cross-language governance contracts (Action, Decision, Approval, ExecutionReceipt, TargetCapability)

# Issue Body

## Summary

Define the canonical, versioned contract schemas for TealTiger's core governance primitives — shared across TypeScript and Python SDKs with cross-language conformance vectors.

This is the P0 foundation for v1.5. Everything else (gate logic, connectors, receipts, control plane) builds on these contracts being stable and explicitly versioned.

**Parent RFC:** #387  
**Assignee:** @CleanDev-Fix

## Contracts to define

| Contract | Purpose |
|----------|---------|
| `Action` | Describes a consequential action an agent intends to perform (tool call, API request, state mutation) |
| `Decision` | The governance engine's evaluation result: ALLOW, DENY, or REFER with full context |
| `Approval` | An exact-action approval binding: action hash + policy digest + approver + nonce + expiry |
| `ExecutionReceipt` | Tamper-evident record linking decision → execution outcome (TEEC receipt) |
| `TargetCapability` | Connector capability declaration: idempotency, reversibility, approval support, reconciliation, compensation |

## Deliverables

- [ ] JSON Schema (draft 2020-12) for each contract at `packages/tealtiger-contracts/schemas/`
- [ ] TypeScript types generated from schemas at `packages/tealtiger-contracts/typescript/`
- [ ] Python dataclasses/Pydantic models generated from schemas at `packages/tealtiger-contracts/python/`
- [ ] Shared conformance vectors at `packages/tealtiger-contracts/vectors/` (JSON fixtures both languages validate against)
- [ ] Validation utilities: `validate_action()`, `validate_decision()`, etc. in both languages
- [ ] CI job: cross-language vector suite runs on every PR touching contracts
- [ ] `contract_version` field in every instance (starting at `1.0.0`)
- [ ] Compatibility documentation: what constitutes a breaking vs. non-breaking change

## Constraints

- **No runtime behavior changes** in this PR — contracts only
- **Additive-only for minor versions** — new optional fields OK, no removals/type changes without major bump
- **Both languages must pass the same vector set** — a contract isn't valid until TS and Python both parse and validate it identically
- **Outcome vocabulary preserved:** `ALLOW`, `DENY`, `REFER` (public surface); `AUTO`, `AUDIT`, `REFER`, `BLOCK` (internal gate ladder)

## Existing surface to reference

The current implicit contracts live in:
- **TypeScript:** `packages/tealtiger-sdk/src/core/engine/v1.2/types.ts`
- **Python:** `packages/tealtiger-python/src/tealtiger/types.py`

This work formalizes and versions what's implicit there today.

## Fields to include (minimum)

### Action
```
action_id, agent_id, action_kind, tool_name, params_hash, 
reversibility_class, timestamp_ms, contract_version
```

### Decision
```
decision_id, action_id, agent_id, action (ALLOW/DENY/REFER),
gate_level (AUTO/AUDIT/REFER/BLOCK), decision_source, 
policy_digest, reason_codes, risk_score, reversibility_class,
evaluation_time_ms, contract_version
```

### Approval
```
approval_id, decision_id, action_hash, policy_digest,
approver_id, tenant_id, nonce, issued_at_ms, expires_at_ms,
scope, contract_version
```

### ExecutionReceipt
```
receipt_id, decision_id, approval_id (optional), 
execution_outcome (executed/blocked/pending/compensated),
target_event_id (optional), reconciliation_status,
timestamp_ms, contract_version
```

### TargetCapability
```
connector_id, idempotent, reversibility_class,
supports_approval, supports_precondition, 
supports_reconciliation, supports_compensation,
policy_mapping_fidelity (EXACT/CONSERVATIVE/OBSERVE_ONLY/UNSUPPORTED),
contract_version
```

## Acceptance criteria

1. Both TS and Python can parse any vector fixture without error
2. Round-trip: serialize → deserialize → serialize produces identical output
3. Unknown fields are preserved (forward compatibility)
4. Invalid instances are rejected with descriptive errors
5. `contract_version` mismatch is detectable at parse time

## Labels

`v1.5`, `P0`, `contracts`, `enhancement`

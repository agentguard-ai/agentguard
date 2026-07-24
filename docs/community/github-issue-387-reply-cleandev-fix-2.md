@CleanDev-Fix — excellent, let's do it.

I'll open a dedicated tracking issue for the P0 contract work and assign you. #387 stays as the RFC umbrella — the new issue will be the implementation-scoped work item.

Here's what I'll include in the tracking issue:

### Scope

Versioned `Action`, `Decision`, `Approval`, `ExecutionReceipt`, and `TargetCapability` contracts with shared TypeScript/Python conformance vectors. Contracts + generation/validation + compatibility fixtures + tests. No runtime behavior changes.

### Source-of-truth format

- **Schema definition:** JSON Schema (draft 2020-12) as the canonical format. TypeScript types and Python dataclasses/Pydantic models are generated from the schema.
- **Location:** `packages/tealtiger-contracts/` (new package, shared by both SDKs)
- **Conformance vectors:** `packages/tealtiger-contracts/vectors/` — JSON fixtures that both TS and Python test suites validate against. A contract change is only valid if both language implementations pass the same vector set.

### Compatibility/versioning policy

- **Semantic versioning** on the contract package itself (independent of SDK versions)
- **Additive-only for minor versions** — new optional fields allowed, no field removals or type changes without major bump
- **Breaking change gate:** Any PR that modifies a contract field runs the full cross-language vector suite. CI blocks if either language fails.
- **Version field in every contract instance:** `"contract_version": "1.0.0"` — consumers can detect/reject incompatible versions at parse time

### Existing surface to reference

The current contract surface lives in:
- **TypeScript:** `packages/tealtiger-sdk/src/core/engine/v1.2/types.ts` (Decision, ModuleResult, etc.)
- **Python:** `packages/tealtiger-python/src/tealtiger/types.py`

The P0 work formalizes and versions what's implicit in those files today — making the contracts the source of truth that both SDKs derive from.

I'll have the tracking issue up within the hour. Welcome aboard.

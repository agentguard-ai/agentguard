@hummbl-dev — saw your tracking issue. This is the most thorough semantic analysis of the v1.5 contracts I've received. All six points are right.

Quick status update on where things stand:

- **P0 contracts are merged** (PR #393 by @CleanDev-Fix) — `packages/tealtiger-contracts/` is now on main at schema version `1.0.0`. JSON Schema (Draft 2020-12), TypeScript types, Python models, shared conformance vectors.
- **The CrewAI GovernanceDecision contract** (PR #6030) is actively being refined with some of the same semantics you raised (exact-action binding, idempotency, normalization).

On your specific points:

1. **Determinism boundary** — we agree `evaluation_time_ms` is performance, not provenance. The contracts now include `policy_digest`, `normalization_id`, and `decision_context_hash` (SHA-256 over the full evaluation inputs). Still need to formalize the complete input enumeration you describe.

2. **Outcome vs. obligations** — this is the right separation. The current contract uses `ALLOW/DENY/REFER` as terminal public outcomes, with `REVISE` as advisory-only. Transformations (redact, degrade) are tracked in the `extensions` dict today but should become first-class typed obligations. Good candidate for a 1.1.0 minor version.

3. **Classification authority** — agreed: an unclassified operation should fail closed. This aligns with our v1.5 RFC point from @Mayur021 about irreversibility classes (C9.2.3/C9.2.4/C9.2.10).

4. **Exact-action canonicalization** — we now require JCS (RFC 8785) for all hash fields and have `normalization_id` to select the digest profile. Cross-language vectors exist in the conformance test suite. The `agent-guard-unwrap-v1` normalization vectors (shell command unwrapping) also landed.

5. **Operation-scoped TargetCapability** — correct that a connector isn't monolithic. This needs work in the next contracts iteration.

6. **Receipt lifecycle separation** — agree these shouldn't be conflated. The `GovernanceOutcome` currently has `executed/blocked/error/timeout` — need to add `partially_applied`, `compensated`, `reconciliation_pending` as distinct states.

**Invitation:** Your feedback is exactly what these contracts need before they're consumed by production connectors. You're welcome to contribute directly — either on the RFC discussion (#387), as a PR against `packages/tealtiger-contracts/`, or as a detailed issue with your proposed schema changes.

The contracts are at `1.0.0` but additive changes (new optional fields, new minor versions) are explicitly supported without breaking. If any of your points require breaking changes, better to surface them now.

Would you prefer to post your full response on #387, or would a dedicated issue focused on the 6 semantic-closure requirements be more useful?

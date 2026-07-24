@CleanDev-Fix — this is the most rigorous technical review this RFC has received. Thank you for the source-backed pass across both the vision and the existing surfaces. Let me respond to the key themes.

### On Scoping: SDK-First, Platform Later

You're right. Shipping all three levels in four months is too many trust boundaries for one release. We're aligning with your recommendation:

**v1.5 = Level 1 complete + optional thin control service (off the authorization path)**

The full Level 2 (eBPF/K8s runtime) and Level 3 (multi-tenant HA platform) move to v1.6+. What ships in v1.5 is:

- Versioned cross-language contracts (Action, Decision, Approval, ExecutionReceipt, TargetCapability)
- Local deterministic gate with signed, fresh, last-known-good policy
- Exact-action approval bound to hash + policy digest + tenant + approver + nonce + expiry
- Re-evaluation before execution
- Canonical receipts + offline verifier
- OTel export as digest-linked projection (not the evidence authority)
- Observe → Enforce → Freeze lifecycle, complete

This is your P0 + P1. We ship something trustworthy and complete at one level before claiming breadth.

### On the Gate Ladder and Outcome Vocabulary

Your internal `AUTO < AUDIT < REFER < BLOCK` → public `ALLOW/DENY/REFER` mapping is cleaner than what we have. Specifically:

- `REFER` as a first-class outcome (not just ALLOW/DENY) solves the approval queue problem properly
- Approval satisfies a gate but never lowers the floor — consistent with the reversibility precedence rule from @Mayur021's thread
- Unavailable/expired/rejected approval stays `REFER`, never executes

We'll adopt this. The current v1.4 surface has `ALLOW/DENY/MONITOR` — we'll extend to `ALLOW/DENY/REFER` in v1.5 with `MONITOR` becoming an internal enforcement mode rather than an outcome.

### On Connector Interface

The `describe → normalize → preview → preflight → execute → reconcile → compensate` lifecycle is the right abstraction. Two things we'll take directly:

1. **Capability declaration per connector** — idempotency, reversibility, approval, precondition, reconciliation, compensation. Unsupported mappings return explicit errors, never silent approximation.
2. **Policy mapping fidelity** — `EXACT`, `CONSERVATIVE`, `OBSERVE_ONLY`, `UNSUPPORTED`. This prevents the false confidence problem where a connector claims enforcement it can't guarantee.

### On Receipt Trust Boundaries

Your claim boundary framing is precise and we'll adopt it in our docs:

> A signed receipt proves the integrity of a recorded service event. It does not prove complete mediation, a trustworthy producer, personal non-repudiation, or that the external action actually occurred.

We'll publish this as part of the TealProof trust model documentation. Native target-event reconciliation and explicit bypass model are required — receipts alone are not sufficient evidence of enforcement completeness.

### On First Connector: GitHub

Agreed. GitHub coding-agent merges and workflow dispatches are the right first proving ground because:
- Actions are bounded and enumerable
- Native evidence is available (check runs, audit log)
- Deployment burden is low (GitHub App, not infra)
- Design partners exist (coding agents are the most common agentic deployment today)

We'll build the GitHub connector as a least-privilege GitHub App with native rulesets and required checks remaining authoritative. TealTiger governs the *decision to act*; GitHub's native controls remain the enforcement substrate.

### On the Suggested Release Cut

We're adopting this nearly verbatim:

| Phase | Scope |
|-------|-------|
| **Alpha** | Generated contracts/vectors, local observe mode, action registry, receipt journal, OTel projection, GitHub fixtures |
| **Beta** | Enforce mode, signed polling/LKG, exact approval, persistent freeze, one OIDC issuer, GitHub test adapter, VAP export preview |
| **Limited GA** | Single-tenant/single-instance L1 parity, minimal control service, canonical receipt viewer/verifier, conformance-tested GitHub adapter |

### On What We're Deferring

Moving to v1.6+ roadmap (not v1.5):
- Custom eBPF/runtime enforcement
- Multi-tenant HA
- Broad compliance analytics
- Natural-language policy activation
- Enforced policy A/B testing (shadow A/B stays in v1.5)
- Large connector marketplace
- Kubernetes Tetragon/Falco as runtime implementations (they'll be correlation inputs for now)

### On Open Source vs. Commercial

Your split is the one we'll follow:

**Open:** Engine, schemas, verifier, adapters, policy tests, RBAC/SSO, self-hostable coordination  
**Commercial:** Managed hosting/BYOC operations, HA/upgrades/backups, retention/search, KMS operations, support/SLA, assurance, maintained mappings

No open-core bait-and-switch. The governance layer stays fully open.

---

### Summary

The positioning you've articulated is sharper than what the RFC originally stated:

> TealTiger is the open, vendor-neutral action-policy and verifiable-decision-receipt layer for tool-using agents: deterministic local enforcement before consequential actions, portable evidence after them.

We're adopting this as the v1.5 positioning statement. It narrows the scope without narrowing the vision — the three-level ADLC architecture remains the roadmap, but v1.5 delivers Level 1 completely and credibly before claiming infrastructure breadth.

Thank you for the depth here. This changes the release plan materially — in the right direction.

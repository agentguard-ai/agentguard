# Reply to @hummbl-dev on Issue #314

## Context
@hummbl-dev's initial comment asked whether `risk_breakdown` should be in the canonical schema or SDK-local. We confirmed: canonical first.

Their follow-up (39m ago) confirms two implementation details:
1. `ModuleResult` has no `score` field — risk_score is derived from `ACTION_SEVERITY[result.action]`. They propose using the same action-severity mapping for breakdown entries.
2. `COMPATIBILITY.md` classifies an optional property addition as minor (1.0.0 → 1.1.0). They ask whether the version bump should be in-PR or maintainer-owned.

---

## Reply (follow-up)

Both assumptions are correct. To confirm explicitly:

**1. Score derivation via ACTION_SEVERITY — yes, use it.**

You're right that `ModuleResult` doesn't carry a numeric score today. Deriving each breakdown entry's `score` from `ACTION_SEVERITY[result.action]` is the correct approach — it preserves the existing invariant (`risk_score = max(breakdown[*].score)`) without introducing new scoring semantics. The `detail` field carries the human-readable context (pattern name, matched content type, etc.), so the numeric score stays mechanical.

One note: if a module returns multiple findings (e.g., TealSecrets detects both an AWS key and a GitHub token in one evaluation), emit one breakdown entry per finding rather than one per module. This gives consumers full attribution. The `source` field should be `"module_name:finding_type"` in that case — e.g., `"teal_secrets:aws_access_key"`.

**2. Version bump — include it in your PR.**

Go ahead and bump contracts to `1.1.0` in your PR. We keep schema identifiers, npm/PyPI versions, and conformance-vector doc version aligned per `COMPATIBILITY.md`, so it's cleanest if the contributor who makes the schema change also bumps the version. I'll validate alignment during review.

---

**You're good to proceed.** Assigning you now. When you open the PR, target `main` and prefix the title with `contracts:` so CI picks up the right workflow.

Looking forward to the PR.

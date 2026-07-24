# Supermemory Issue — TealTiger Memory Governance Integration

## Issue Title

`[Feature Request] Memory governance layer — PII redaction, context poisoning defense, and audit trail for memory retrieval`

---

## Issue Body

### Problem

When AI agents use Supermemory to store and retrieve context, there's no governance layer between memory retrieval and the LLM. This creates three risks in regulated environments:

1. **PII in memories** — A user shares "my SSN is 123-45-6789" in a conversation. Supermemory correctly extracts and stores this as a fact. When another agent retrieves this user's profile, the SSN flows directly into the LLM context — no scan, no redaction, no audit trail.

2. **Context poisoning** — Connectors (Google Drive, Gmail, Notion) auto-sync external content into the knowledge base. If a poisoned document enters via a connector, it becomes part of every future retrieval for that container. There's no governance checkpoint between "connector ingested this" and "agent received this as context."

3. **No audit evidence for memory reads** — In SOC2/HIPAA environments, teams need to prove what context entered the agent for a given request. Currently there's no structured record of which memories/profile facts were retrieved, what was filtered, and what reached the LLM.

### Proposed Solution

A governance hook at the memory retrieval boundary — between `client.profile()` / `client.search()` returning results and those results entering the agent's context.

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0) deterministic governance SDK that provides exactly this. We'd like to propose an integration, either as:

**(a) A Supermemory plugin/middleware** that wraps retrieval with governance, or
**(b) A retrieval hook** in the Supermemory SDK that allows governance engines to scan results before they're returned to the caller.

### What the integration would provide

| Capability | Description |
|-----------|-------------|
| **PII redaction on retrieval** | Scan memories/profile for SSN, credit card, email, phone, API keys before returning to the caller. Redact or block. |
| **Context poisoning defense** | Detect prompt injection patterns in retrieved memories/documents (e.g., "ignore previous instructions" injected via a connector sync). |
| **Per-retrieval cost tracking** | Track cumulative retrieval cost (embedding calls + LLM extraction) per session with hard budget limits. |
| **Structured audit trail** | Every `profile()` / `search()` call produces a governance record: what was retrieved, what was scanned, what was redacted, what reached the caller. Correlation IDs link to downstream LLM calls. |
| **Connector allowlisting** | Only memories from approved connector sources (e.g., "Google Drive but not Gmail") can enter context for a given agent. |

### Technical Approach

```typescript
import Supermemory from "supermemory";
import { TealTigerMemoryGovernance } from "tealtiger-supermemory";

const client = new Supermemory();
const governance = new TealTigerMemoryGovernance({
  mode: "ENFORCE", // OBSERVE | MONITOR | ENFORCE
  pii: { action: "redact", categories: ["ssn", "credit_card", "email"] },
  injection: { action: "block" },
  budget: { maxRetrievalsPerSession: 50 },
});

// Governed retrieval — PII redacted, injection blocked, audit emitted
const { profile, searchResults } = await governance.governedProfile(client, {
  containerTag: "user_123",
  q: "user preferences",
});

// profile.static entries with PII are redacted before reaching your agent
// governance.getAuditTrail() returns structured evidence for compliance
```

### Why this matters for Supermemory users

- **Enterprise adoption** — Regulated industries (fintech, healthcare, legal) can't use memory systems that don't provide governance evidence. This is the #1 blocker for enterprise memory adoption.
- **Connector safety** — Auto-sync is powerful but risky. A governance layer makes it safe to connect untrusted sources.
- **Differentiation** — No other memory system (Mem0, Zep, Letta) offers built-in governance. This would be unique.

### Implementation options

We're happy to:
1. Build and maintain a standalone `tealtiger-supermemory` package on our side (no changes needed in Supermemory core)
2. Propose a retrieval middleware/hook API in Supermemory that any governance provider can use
3. Contribute directly if you'd prefer it in the Supermemory repo

### References

- TealTiger: https://github.com/agentguard-ai/tealtiger
- PyPI: https://pypi.org/project/tealtiger/
- npm: https://www.npmjs.com/package/tealtiger-ai-sdk
- Similar integration (Haystack): https://pypi.org/project/tealtiger-haystack/
- Similar integration (Mem0): `packages/tealtiger-mem0` in TealTiger repo

Happy to discuss approach — open to whatever fits Supermemory's architecture best.

# n8n Community Forum Post — TealTiger Governance Node

## Title

Governance node for AI Agent workflows — PII scanning, cost budgets, and compliance audit trail

---

## Body (paste this)

**The idea is:**

A governance node that evaluates deterministic policy (PII detection, cost budget enforcement, tool-call authorization) before AI-generated actions execute. Place it between any AI node and an action node to scan content, enforce limits, and produce structured audit evidence — with no LLM in the governance path and <2ms latency.

Workflow placement:
```
[Webhook] → [Governance: PII Scan] → [AI Agent] → [Governance: Tool Auth] → [HTTP Request] → [Response]
```

The node would provide:
- PII detection + redaction (SSN, credit card, email, phone, API keys) — pattern-based, deterministic
- Per-execution cost budget with hard stop (kills the workflow when $X exceeded)
- Tool/action authorization (allowlist/denylist for downstream nodes the AI agent can trigger)
- Prompt injection detection on incoming user input
- Structured JSON audit record per evaluation (correlation_id, findings, decision, latency)

**My use case:**

I run n8n AI Agent workflows in fintech that process customer data. Three concrete problems:

1. Webhook input containing SSNs and credit card numbers flows directly into the OpenAI node — no scan, no evidence for auditors.
2. The AI Agent node with tools looped 200+ times on a failing API call, burning $40 in a single execution. No cost cap stopped it.
3. SOC2 auditors asked "prove that PII was evaluated before reaching the model for every request." I had to build custom Function nodes to produce that evidence — fragile and non-standard.

**I think it would be beneficial to add this because:**

- Enterprise teams deploying n8n for AI workflows need compliance evidence (SOC2, HIPAA, PCI-DSS)
- AI Agent node loops need cost caps — this is a safety issue, not just a nice-to-have
- No other automation platform (Make, Zapier) offers a governance node — this would differentiate n8n for regulated environments
- The node is simple: input → evaluate policy → passthrough or block. No complex logic, fast, deterministic.

**Any resources to support this?**

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0 governance SDK (already integrated with Haystack, CrewAI, AG2, and 10+ frameworks)
- npm: https://www.npmjs.com/package/tealtiger-ai-sdk (TypeScript SDK for n8n node implementation)
- Docs: https://docs.tealtiger.ai
- Similar component for Haystack pipelines: https://pypi.org/project/tealtiger-haystack/
- OWASP AI Security mapping: https://docs.tealtiger.ai/owasp/

**Are you willing to work on this?**

Yes — I'll build and publish it as a community node (`n8n-nodes-tealtiger`) using the TypeScript SDK. Happy to share a draft for feedback before publishing.

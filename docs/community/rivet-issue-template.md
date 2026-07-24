# Rivet Issue — TealTiger Governance Node

## Title

Governance node — deterministic PII scanning, cost budgets, and output authorization for AI graphs

---

## Feature Request

### What

A **Governance node** for Rivet graphs that evaluates deterministic policy (PII detection, cost budget enforcement, output authorization) between any two nodes. Place it before a Chat node to scan inputs, or after retrieval to redact PII before it reaches the model. No LLM in the governance path — <2ms per evaluation.

### Why

Rivet is used by Ironclad (legal-tech) and teams building AI features for regulated industries. Legal workflows process contracts containing PII (SSNs, names, addresses, account numbers). When these documents flow through a Rivet graph into an LLM, there's:

1. **No PII gate between document retrieval and the model.** Retrieved contract text containing client SSNs, payment details, or privileged information enters the prompt unscanned. Legal teams need evidence that PII was evaluated before reaching the LLM.

2. **No per-graph-execution cost budget.** A Rivet graph with loops (or subgraphs calling subgraphs) can accumulate unbounded LLM cost. There's no node that hard-stops execution when $X is exceeded.

3. **No structured compliance evidence per execution.** For legal compliance and SOC2, teams need per-node audit records: what was scanned, what was found, what decision was made. Currently requires wrapping every external call node with custom logic.

### How it would work

**Graph placement:**
```
[Document Input] → [Governance: PII Scan] → [Chat Node] → [Governance: Output Check] → [Output]
```

**Node configuration (in Rivet's visual editor):**
- Mode: Observe / Monitor / Enforce
- PII Categories: SSN, Credit Card, Email, Phone, API Key (checkboxes)
- PII Action: Detect Only / Redact / Block
- Cost Budget: Max USD per graph execution
- Output Auth: Block outputs containing secrets or unauthorized content

**Node inputs:** Text (string)
**Node outputs:**
- `output` (string) — passthrough if allowed, redacted if configured, empty if blocked
- `decision` (object) — `{action, findings, risk_score, correlation_id, latency_ms}`
- `blocked` (boolean) — for conditional routing

### Implementation

Built on [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0) — a deterministic governance SDK. The Rivet node would use the TypeScript SDK (`npm install tealtiger-ai-sdk`). We can implement this as:

1. A Rivet plugin node (preferred — follows Rivet's plugin architecture)
2. A custom node type contributed to Rivet core

### Who this helps

- Legal-tech teams processing contracts through AI (Ironclad's core use case)
- Enterprise teams deploying Rivet graphs that handle customer data
- Any team that needs SOC2/HIPAA evidence for AI-processed documents
- Compliance officers who need audit trails without writing code

### References

- TealTiger: https://github.com/agentguard-ai/tealtiger
- npm: https://www.npmjs.com/package/tealtiger-ai-sdk
- Similar node (Haystack): https://pypi.org/project/tealtiger-haystack/
- Similar node (Langflow): proposed at langflow-ai/langflow

Happy to implement this as a plugin and submit a PR.

---

## Code of Conduct

- [x] I agree to follow this project's Code of Conduct

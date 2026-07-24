# Langflow Issue — TealTiger Governance Component

## Title

Governance component — deterministic PII scanning, cost budgets, and tool authorization as a drag-and-drop node

---

## Feature Request

A **Governance component** for the Langflow component library that provides deterministic policy enforcement (PII detection, cost budget caps, tool-call authorization, prompt injection defense) as a visual node — no LLM in the governance path, <2ms per evaluation.

**What it does:** Place between any two nodes in a workflow. It scans content, enforces policy, and emits a structured audit record. If policy is violated, the flow is halted with a typed decision (DENY + reason).

**Component inputs:**
- `text` (str) — content to evaluate
- `tool_name` (str, optional) — tool being called (for authorization)

**Component outputs:**
- `text` (str) — passthrough if allowed, empty if denied
- `decision` (dict) — structured governance record (correlation_id, action, findings, risk_score, latency_ms)
- `blocked` (bool) — whether the content was denied

**Configuration (visual builder):**
- Mode: OBSERVE / MONITOR / ENFORCE
- PII Action: detect / redact / block
- PII Categories: ssn, credit_card, email, phone, api_key (multi-select)
- Tool Allowlist: comma-separated tool names
- Cost Budget (USD): max spend per session
- Max Iterations: hard cap on loop iterations
- Injection Defense: toggle on/off

**Workflow placement example:**
```
[Chat Input] → [Governance: Input Guard] → [Retriever] → [Governance: PII Redact] → [LLM] → [Output]
```

**Reference implementation:** [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0, NVIDIA Inception) — deterministic governance SDK already integrated with Haystack, CrewAI, AG2, Composio, and 8 other frameworks. The Langflow component would wrap the Python SDK (`pip install tealtiger`).

- PyPI: https://pypi.org/project/tealtiger/
- Docs: https://docs.tealtiger.ai
- Similar component (Haystack): https://pypi.org/project/tealtiger-haystack/

---

## Motivation

I'm deploying Langflow workflows in a regulated environment (fintech) and I'm always frustrated when:

1. **RAG pipelines leak PII to the LLM.** Retrieved documents contain SSNs and credit card numbers. They flow into the model context unscanned. I need a visual node that redacts PII before the LLM sees it — and produces evidence for auditors that the scan happened.

2. **Agent loops burn unlimited budget.** A Langflow agent workflow with tools can loop indefinitely. I've had sessions hit $30+ because there's no hard-stop component that kills the flow when cost exceeds a threshold.

3. **No compliance evidence for auditors.** Langflow logs execution, but doesn't produce structured governance records (decision ID, policy evaluated, PII findings, risk score) that pass SOC2/HIPAA audits. I currently export logs manually and reformat them — fragile and non-reproducible.

4. **Compliance officers can't add governance without code.** Our compliance team wants to add PII scanning to existing workflows but can't modify Python. A visual governance node they can drag-and-drop would unblock them entirely.

No other visual AI workflow builder has a built-in governance component. This would differentiate Langflow for enterprise adoption.

---

## Your Contribution

Yes — I'm willing to submit a PR implementing this as a custom component (following CONTRIBUTING.md). The implementation wraps `tealtiger` (already published on PyPI) as a Langflow `Component` with typed inputs/outputs. Happy to follow whatever component structure conventions the team prefers.

I can provide:
- The component implementation (Python, using Langflow's `Component` base class)
- Tests
- Documentation page
- Example workflow JSON demonstrating the governance node in a RAG pipeline

Just need confirmation on: should this live in `src/backend/base/langflow/components/` as a built-in, or as an external custom component package?

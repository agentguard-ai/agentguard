# Dify Issue — TealTiger Governance Integration

## Title

Deterministic governance node for workflows — PII scanning, tool-call authorization, cost budgets, and structured audit evidence

---

## 1. Is this request related to a challenge you're experiencing? Tell me about your story.

We're deploying Dify workflows in a regulated fintech environment and hit three governance gaps:

**Problem 1: No PII gate between retrieval and the LLM.** Our RAG workflows retrieve customer records containing SSNs and credit card numbers. These flow directly into the model prompt with no scan or redaction step. For SOC2/PCI-DSS compliance, we need evidence that sensitive data was evaluated before reaching the LLM — not just that it was logged after the fact.

**Problem 2: No per-workflow cost budget with hard stop.** We run agent workflows that call tools in loops. A stuck workflow burned $47 in a single session because there's no mechanism to halt execution when cumulative LLM cost exceeds a threshold. We need a cost cap that terminates the workflow — not a soft warning.

**Problem 3: No structured governance audit trail.** Dify logs execution, but auditors need a standardized governance decision record per evaluation: correlation ID, policy evaluated, risk score, action taken (ALLOW/DENY), evaluation latency, and PII findings. Currently we build custom logging wrappers around every workflow, which breaks on Dify updates.

**Proposed solution:** A governance node (or plugin) that sits in the workflow between retrieval and LLM (or before tool calls) and evaluates policy deterministically. No LLM in the governance path, <2ms per evaluation. We've built this for other frameworks using [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0, deterministic governance SDK).

The node would provide:
- PII detection + redaction (SSN, credit card, email, phone, API keys) — pattern-based, deterministic
- Tool-call authorization (allowlist/denylist per workflow)
- Per-session cost budget with hard termination
- Prompt injection / jailbreak detection on user input
- Structured JSON audit record for every evaluation (exportable as SARIF/JUnit XML for CI/CD gates)
- Kill switch: freeze a workflow across all sessions immediately

**Visual workflow placement:**
```
[User Input] → [Governance: Input Scan] → [Retriever] → [Governance: PII Redact] → [LLM] → [Governance: Tool Auth] → [Tool] → [Output]
```

---

## 2. Additional context or comments

- TealTiger already ships adapters for Haystack (`pip install tealtiger-haystack`), AG2, CrewAI, Composio, Strands, PydanticAI, Google ADK, and others. Dify would be the first visual-builder integration.
- We're happy to build this as a Dify plugin (using the plugin system) or contribute a built-in governance node — whichever the team prefers.
- The integration requires no external infrastructure — TealTiger evaluates in-process with <2ms latency.
- Reference: https://github.com/agentguard-ai/tealtiger | https://pypi.org/project/tealtiger/ | https://docs.tealtiger.ai

---

## 3. Can you help us with this feature?

✅ I am interested in contributing to this feature.

We'll build and maintain the integration. Just need guidance on whether the plugin system or a custom node type is the preferred extension point for third-party governance providers.

# Letta Issue — TealTiger Governance Integration

## Title

Governance hooks for tool execution and memory access — PII scanning, tool-call authorization, cost budgets, and memory access control

---

## AI Disclosure

- [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and reviewed and edited by a human
- [x] I have read the AI Policy and agree to its terms

---

## Human Verification

I have read the AI policy and I confirm this issue was reviewed by a human.

---

## Problem Statement

Letta agents have persistent memory, tool-calling capabilities, and long-running sessions. In regulated deployments (fintech, healthcare, enterprise), this creates governance gaps:

1. **PII accumulates in agent memory with no governance boundary.** Users share sensitive data (SSNs, credit cards, medical info) in conversations. Letta correctly stores this in core/archival memory. When the agent recalls this memory in future sessions, PII flows into the LLM context unscanned. There's no policy layer that governs what memory content is allowed to enter a prompt.

2. **No tool-call authorization.** Letta agents call tools (functions) based on LLM reasoning. There's no deterministic policy gate that evaluates "should this agent call this tool with these arguments?" before execution. An agent with access to both `read_database` and `delete_record` can execute either based purely on the model's judgment.

3. **No per-session or per-agent cost budget.** Long-running Letta agents can accumulate unbounded token costs over time. An agent stuck in a memory-recall→tool-call loop burns tokens indefinitely. There's no hard cap that terminates a session when cost exceeds a threshold.

4. **No structured governance audit trail.** For SOC2/HIPAA compliance, teams need to prove: what memory was accessed, what tools were called, what PII was present, and what governance decisions were made — per request. Currently requires custom instrumentation.

---

## Proposed Solution

A governance layer at two boundaries:

**1. Pre-tool governance** — before each tool/function call, evaluate policy:
```python
from letta import create_client
from tealtiger_letta import GovernanceConfig

client = create_client()

governance = GovernanceConfig(
    mode="ENFORCE",
    tool_policy={
        "allowlist": ["search_memory", "send_message", "read_file"],
        "denylist": ["delete_record", "execute_sql", "send_email"],
    },
    pii={
        "on_memory_recall": "redact",  # redact PII when memory enters prompt
        "on_tool_args": "block",       # block tool calls containing PII
        "categories": ["ssn", "credit_card", "api_key"],
    },
    budget={"per_session_usd": 2.00, "per_agent_daily_usd": 10.00},
)

agent = client.create_agent(
    name="support-bot",
    tools=["search_memory", "send_message"],
    # governance applied at the server level via middleware
)
```

**2. Memory-recall governance** — when archival/core memory is retrieved, scan before it enters the prompt:
- Detect PII in recalled memories
- Redact or block based on policy
- Emit audit record of what was recalled and what was filtered

**Capabilities:**

| Feature | Description |
|---------|-------------|
| Tool-call authorization | Allowlist/denylist per agent. DENY before execution with structured reason. |
| Memory PII governance | Scan recalled memory for PII before it enters the prompt. Redact or block. |
| Cost budget | Per-session and per-agent daily limits. Hard stop on exceed. |
| Circuit breaker | Per-model failure tracking. Stop cascading retries. |
| Kill switch | `governance.freeze(agent_id)` — halt agent immediately. |
| Structured audit | Every evaluation: `{correlation_id, action, findings, cost_so_far, latency_ms}` |

---

## Alternatives Considered

- **Custom tool wrappers** — wrap every tool function with governance checks. Works but doesn't scale, breaks on Letta updates, no centralized policy, no audit trail.
- **Prompt instructions** ("never share SSNs") — unreliable. The LLM ignores this under adversarial input or when memory contains conflicting context. Not auditable.
- **Post-hoc log filtering** — catches violations after the fact. Doesn't prevent PII from reaching the model. Auditors want preventive evidence, not reactive.
- **Memory content filtering on write** — helps but insufficient. PII written before governance was enabled persists. Need governance on read as well.

---

## Additional Context

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0, NVIDIA Inception, deterministic governance SDK (<2ms per evaluation, no LLM in governance path)
- PyPI: https://pypi.org/project/tealtiger/
- Similar integrations: AG2, CrewAI, Haystack, Composio, Google ADK, PydanticAI, Strands
- The memory governance angle is unique to Letta — no other framework stores and recalls long-term memory that persists across sessions, making PII-in-memory a Letta-specific concern.
- We're happy to build `tealtiger-letta` as a standalone package or contribute as server middleware. Open to guidance on the preferred extension mechanism.

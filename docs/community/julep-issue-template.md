# Julep Issue — TealTiger Governance Integration

## Title

[Feature] Deterministic governance for task steps — tool-call authorization, PII scanning, cost budgets, and step-level audit trail

---

## Description

### Problem

Julep orchestrates multi-step agent tasks with tool calls, conditional branching, and long-running sessions. In regulated environments, three governance gaps block production deployment:

1. **No per-step policy gate.** When a task step calls an integration or tool, there's no authorization layer that evaluates "should this agent, at this step, call this tool with these arguments?" before execution. An agent with access to both read and write integrations can invoke either based purely on LLM judgment — no policy enforcement.

2. **No PII boundary on session context.** Sessions accumulate user data over time. When context is assembled for a step, PII (SSNs, credit cards, API keys) from earlier in the session flows into the model prompt with no scan or redaction. Auditors require evidence that sensitive data was evaluated before reaching the LLM.

3. **No per-task or per-session cost budget.** Multi-step tasks with loops (`foreach`, `map_reduce`) can iterate indefinitely. A stuck task burns tokens with no termination mechanism. We need a hard cost cap per task execution that kills the run when exceeded.

4. **No structured governance audit per step.** For SOC2/HIPAA, teams need per-step evidence: what was evaluated, what was found (PII, injection), what decision was made (ALLOW/DENY), and how long it took. Currently requires custom logging at every integration call.

### Proposed Solution

A governance middleware (or task step type) that evaluates deterministic policy before each tool/integration call. No LLM in the governance path, <2ms per evaluation.

```yaml
# In task definition — governance as a step or as task-level config
governance:
  mode: ENFORCE
  tool_policy:
    allowlist: [web_search, send_email]
    denylist: [delete_user, execute_sql]
  pii:
    action: redact
    categories: [ssn, credit_card, api_key]
  budget:
    per_task_usd: 3.00
    max_steps: 50
  audit: true  # emit GovernanceDecision record per step
```

Or programmatically:
```python
from julep import Julep
from tealtiger_julep import GovernanceMiddleware

client = Julep(api_key="...")

governance = GovernanceMiddleware(
    mode="ENFORCE",
    tool_policy={"allowlist": ["web_search"], "denylist": ["delete_*"]},
    pii={"action": "redact", "categories": ["ssn", "credit_card"]},
    budget={"per_task_usd": 3.00, "max_steps": 50},
)

# Apply governance to task execution
execution = client.executions.create(
    task_id=task.id,
    input={"query": "Find customer info"},
    middleware=[governance],
)
```

**What governance provides per step:**

| Capability | Description |
|-----------|-------------|
| Tool-call authorization | Per-agent allowlist/denylist before integration call. DENY halts step with reason. |
| PII scanning | Scan step inputs/outputs for SSN, CC, email, keys. Redact or block. <2ms. |
| Cost budget | Per-task + per-session limits. Hard stop when exceeded. |
| Iteration cap | `max_steps` kills `foreach`/`map_reduce` loops that don't converge. |
| Injection defense | Detect prompt injection in user input before it enters the task. |
| Structured audit | Every step: `{step_id, tool, decision, findings, cost_so_far, latency_ms}` |
| Kill switch | `governance.freeze(execution_id)` — halt a running task immediately. |

### Why this matters for Julep

- Multi-step tasks are the core Julep primitive — governance needs to be per-step, not per-session
- Long-running executions need cost caps (tasks can run for minutes/hours)
- Julep's YAML-based task definitions make declarative governance config a natural fit
- Enterprise teams evaluating Julep vs. alternatives need compliance evidence out of the box

### References

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0, deterministic governance SDK, <2ms, no LLM in governance path
- PyPI: https://pypi.org/project/tealtiger/
- Docs: https://docs.tealtiger.ai
- Similar integrations: AG2, CrewAI, Haystack, Composio, Google ADK, PydanticAI

Happy to build `tealtiger-julep` as a standalone package or contribute as server middleware. Open to whatever extension mechanism fits Julep's architecture.

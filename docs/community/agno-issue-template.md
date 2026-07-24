# Agno Issue — TealTiger Governance Integration

## Title

Deterministic governance middleware for agents — tool-call authorization, PII detection, cost budgets, and per-agent kill switch

---

## Problem Description

When deploying Agno agents in production (especially multi-agent teams), there's no governance layer between the LLM's tool-call decision and actual tool execution. This creates three blockers for regulated environments:

1. **No tool-call authorization.** An agent calls any tool in its toolkit based on LLM reasoning alone. There's no policy gate that evaluates "should this agent, with this role, call this tool, with these arguments?" before execution. An agent can escalate privileges or access restricted resources if the model decides to.

2. **No per-agent cost governance.** In multi-agent scenarios (teams, workflows), individual agents can consume unbounded tokens. A single stuck agent in a retry loop can burn the entire session budget. There's no per-agent cost cap with hard termination.

3. **No kill switch.** If an agent misbehaves in production (calling the wrong tools, leaking data, looping), there's no mechanism to immediately freeze it without redeploying the entire system.

These are table-stakes requirements for deploying agents in fintech, healthcare, or any SOC2-compliant environment. Agno already emphasizes "security posture (JWT-based RBAC)" — governance is the natural next layer.

---

## Proposed Solution

A governance middleware that hooks into Agno's agent execution — evaluated deterministically (no LLM in the governance path, <2ms) before every tool call.

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from tealtiger_agno import TealTigerGovernance

governance = TealTigerGovernance(
    mode="ENFORCE",  # OBSERVE | MONITOR | ENFORCE
    tool_policy={
        "allowlist": ["search_docs", "get_customer"],
        "denylist": ["delete_account", "transfer_funds"],
    },
    pii={"action": "block", "categories": ["ssn", "credit_card", "api_key"]},
    budget={"per_session_usd": 2.00, "per_agent_usd": 0.50},
    kill_switch={"enabled": True},
)

agent = Agent(
    model=OpenAIChat(id="gpt-4o"),
    tools=[search_tool, customer_tool],
    middleware=[governance],
)

response = agent.run("Look up customer 123")
# → Tool calls authorized before execution
# → PII in tool results scanned before entering context
# → Cost tracked; BudgetExceededError if limit hit
# → governance.freeze("agent_id") halts agent immediately
```

**Capabilities:**

| Feature | Description |
|---------|-------------|
| Tool-call authorization | Per-agent allowlist/denylist. DENY returns structured reason without executing. |
| PII detection | Scan tool args + results for SSN, credit card, email, phone, API keys. <2ms. |
| Cost budget | Per-request, per-session, per-agent limits. Hard stop on exceed. |
| Circuit breaker | Per-model CLOSED→OPEN→HALF_OPEN. Stops cascading retries. |
| Kill switch | `governance.freeze("agent_id")` — immediately denies all calls. |
| Multi-agent scoping | Different policies per `agent_role` in team scenarios. |
| Structured audit | Every evaluation: `{correlation_id, policy_refs, risk_score, action, latency_ms}` |

**For multi-agent teams:**
```python
# Explorer gets broad read access, Executor gets narrow write access
explorer_gov = TealTigerGovernance(
    tool_policy={"allowlist": ["search_*", "list_*"]},
    budget={"per_agent_usd": 1.00},
)
executor_gov = TealTigerGovernance(
    tool_policy={"allowlist": ["update_customer"], "denylist": ["delete_*"]},
    budget={"per_agent_usd": 0.25},
)
```

---

## Alternatives Considered

- **Prompt-level guardrails** ("never call delete_account") — unreliable. The LLM ignores instructions under adversarial input or long contexts. Not auditable.
- **Custom `before_tool_call` wrappers** — works but fragile, no standard interface, breaks on Agno updates, no structured audit.
- **External proxy (API gateway)** — adds latency (network hop), doesn't have agent context (role, session cost), can't kill individual agents.

None of these provide deterministic, per-agent, sub-2ms governance with structured compliance evidence.

---

## Additional Context

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0, NVIDIA Inception, Python SDK on PyPI (`pip install tealtiger`)
- Already integrated with: AG2, CrewAI, Haystack, Composio, Strands, PydanticAI, Google ADK, LangChain
- PyPI (AG2 adapter): https://pypi.org/project/ag2-tealtiger/
- Docs: https://docs.tealtiger.ai
- Agno already lists "security posture" as a differentiator — governance middleware completes that story

---

## Would you like to work on this?

**Yes, I'd love to work on it!**

We'll build `tealtiger-agno` as a standalone PyPI package. Need guidance on: is there a middleware/hook registration API for pre-tool-call interception, or should we subclass/wrap the Agent?

# Future AGI Feature Request

## Title

TealTiger deterministic governance as a gateway guardrails plugin

## What problem are you trying to solve?

I can't enforce deterministic governance policies (tool allowlists, PII blocking, cost budgets, kill switches) at the Future AGI gateway level because the current guardrails system doesn't have a pluggable policy engine that evaluates before requests route to providers.

Teams using Future AGI for tracing and evaluation have no way to **block** unauthorized or dangerous actions at the gateway — they can only observe after the fact. The gap: observability tells you what happened, but governance prevents what shouldn't happen.

## Proposed solution

Integrate [TealTiger](https://github.com/agentguard-ai/tealtiger) as a guardrails plugin for the Future AGI gateway that evaluates deterministic governance policies before requests execute.

```python
# Future AGI gateway config with TealTiger governance
guardrails:
  - type: tealtiger
    mode: enforce  # or observe, monitor
    policies:
      - pii_block: [ssn, credit_card]
      - cost_limit: {max_per_session: 5.00}
      - tool_allowlist: {agent: "coder", allowed: ["code_*", "search_*"]}
      - secret_detection: true
```

**What this gives Future AGI users:**

| Capability | Description |
|-----------|-------------|
| Tool allowlisting | Block unauthorized tool calls per agent/role at the gateway |
| PII detection | Block SSN, credit cards, emails before they reach providers |
| Cost governance | Per-session/agent budget enforcement |
| Kill switch | Instant `freeze("agent_id")` blocks all requests fleet-wide |
| Audit trail | Structured governance receipt for every decision |

**Governance decisions as OTel spans in Future AGI traces:**

Each governance evaluation emits a span that appears in the Future AGI trace viewer — showing exactly where and why a request was allowed or blocked, inline with LLM call traces.

```
Agent Request → [TealTiger: ALLOW/DENY/REFER] → Gateway Routes → Provider
                      ↓
              Appears as span in Future AGI trace
```

**About TealTiger:** Open-source (Apache 2.0), deterministic (<5ms, no LLM in governance path), already integrated with LangChain, CrewAI, AG2, Haystack, Composio, Langfuse, AgentOps. [GitHub](https://github.com/agentguard-ai/tealtiger) | [PyPI](https://pypi.org/project/tealtiger/) | NVIDIA Inception member.

Happy to build the gateway plugin or collaborate on the integration approach.

## Alternatives you considered

- Writing custom guardrail rules per provider endpoint — doesn't scale, not reusable across frameworks
- Using LLM-based content filters — non-deterministic, slow (100ms+), expensive, can't enforce tool access control
- External proxy (Portkey, LiteLLM) — adds network hop, separate system to manage, no integration with Future AGI's trace viewer

TealTiger solves this in-process with <5ms overhead and deterministic evaluation.

## Area

Gateway / Guardrails

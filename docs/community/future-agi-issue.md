# Issue Title

[Integration]: TealTiger deterministic governance as a guardrails/enforcement layer

# Issue Body

## Summary

Integrate [TealTiger](https://github.com/agentguard-ai/tealtiger) as a deterministic governance layer that plugs into Future AGI's gateway and tracing infrastructure — adding policy enforcement, tool access control, PII detection, cost governance, and structured audit evidence before agent actions execute.

## Why this integration?

Future AGI provides observability (what happened) and evaluation (how well). TealTiger adds **enforcement** (what's allowed to happen) — the governance layer that answers "should this action execute?" before it reaches external services.

The combination gives teams:
- **Tracing** (Future AGI) + **governance decisions** (TealTiger) in the same trace
- **Gateway-level** enforcement: TealTiger evaluates policies at the gateway before requests route to LLM providers
- **Guardrails** backed by deterministic policy evaluation (<5ms, no LLM in the governance path)
- **Cost governance**: per-agent/session budgets enforced at the gateway, not just tracked

## Proposed integration points

### 1. Gateway guardrails hook

TealTiger evaluates governance policies as a pre-request guardrail in the Future AGI gateway:

```python
# Gateway config
guardrails:
  - type: tealtiger
    mode: enforce
    policies:
      - pii_block: [ssn, credit_card]
      - cost_limit: {max_per_session: 5.00}
      - tool_allowlist: {agent: "coder", allowed: ["code_*", "search_*"]}
```

### 2. Tracing integration (OpenTelemetry spans)

TealTiger governance decisions emitted as OTel spans that appear in Future AGI traces:

```python
from tealtiger.integrations.langfuse import LangfuseGovernanceExporter
# Same pattern — TealTiger already exports governance decisions as spans
# Would map to Future AGI's tracing via OpenTelemetry
```

### 3. Evaluation integration

TealTiger governance correctness as evaluation metrics in Future AGI's eval framework:
- Did the policy make the right ALLOW/DENY decision?
- False positive rate (legitimate requests blocked)
- False negative rate (policy bypasses)

## What TealTiger provides

| Capability | How |
|-----------|-----|
| Tool allowlisting | Block unauthorized tool calls per agent/role |
| PII detection | Block SSN, credit cards, emails, phone numbers in requests |
| Secret detection | Block API keys, tokens before they reach providers |
| Cost governance | Per-session/agent budget enforcement |
| Kill switch | Instant freeze/unfreeze per agent or fleet-wide |
| Audit trail | Structured TEEC receipt for every governance decision |

All evaluation is **deterministic** (<5ms, no LLM in the governance path), **in-process**, and **Apache 2.0**.

## About TealTiger

- [GitHub](https://github.com/agentguard-ai/tealtiger) (Apache 2.0)
- [PyPI](https://pypi.org/project/tealtiger/) | [npm](https://www.npmjs.com/package/tealtiger)
- NVIDIA Inception member
- Already integrated with: LangChain, CrewAI, AG2, Haystack, Strands, LlamaIndex, PydanticAI, Composio, Langfuse, AgentOps

## Next steps

Happy to:
1. Build a `tealtiger` guardrails plugin for the Future AGI gateway
2. Add TealTiger governance spans to the tracing pipeline
3. Start with whichever integration point your team prefers

CC: @nikhilpareek — per our email conversation.

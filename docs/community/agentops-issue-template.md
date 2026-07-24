## Issue Title

```
[Integration]: TealTiger — Governance decisions as AgentOps session events
```

## Issue Body

### What

We've built a `tealtiger.integrations.agentops` module that exports AI agent governance decisions as AgentOps ActionEvents/ErrorEvents — giving teams governance visibility inline with their existing agent session timelines.

### How it works

```python
import agentops
from tealtiger.integrations.agentops import AgentOpsGovernanceReporter

agentops.init()
reporter = AgentOpsGovernanceReporter()

# Each governance decision → AgentOps event in the session timeline
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI(), on_decision=reporter.report)
```

Each governance decision maps to AgentOps events:

| TealTiger Decision | AgentOps Event | Timeline |
|---|---|---|
| ALLOW | `ActionEvent(action_type="governance:allow")` | Normal action |
| DENY | `ErrorEvent(error_type="governance:deny")` | Red error marker |
| MONITOR | `ActionEvent(action_type="governance:monitor")` | Warning action |

Event params include: `risk_score`, `reason_codes`, `evaluation_time_ms`, `cost_tracked`, `cumulative_cost`, `pii_count`, `tool_slug`, `agent_id`.

### What is TealTiger?

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0) deterministic governance SDK for AI agents. It provides policy enforcement, PII detection, cost tracking, tool allowlisting, and audit evidence — with no LLM in the governance path and <5ms overhead.

- [PyPI](https://pypi.org/project/tealtiger/)
- [npm](https://www.npmjs.com/package/tealtiger)
- Already integrated with: [Haystack](https://haystack.deepset.ai/integrations/tealtiger), [AG2](https://github.com/ag2ai/ag2/pull/2962), [Composio](https://github.com/ComposioHQ/composio/pull/3856), [Langfuse](https://github.com/langfuse/langfuse-docs/issues) (pending)

### Why AgentOps?

AgentOps already provides session replay for CrewAI, LangChain, AG2, and OpenAI Agents SDK. TealTiger adds a dimension none of those frameworks provide: **deterministic governance events** — which tools were denied, why, what risk score was assigned, and how much budget remains. Combining both gives:

- Agent execution timeline (AgentOps) + governance decision points (TealTiger)
- Cost tracking from two angles: LLM spend (AgentOps) + budget enforcement (TealTiger)
- Session replay showing exactly where and why a tool call was blocked

### Source

- Integration module: [src/tealtiger/integrations/agentops.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/src/tealtiger/integrations/agentops.py)
- Example: [examples/agentops_governance_events.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/examples/agentops_governance_events.py)
- Tests: [tests/test_agentops_integration.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/tests/test_agentops_integration.py)

### Ask

Would you be open to listing TealTiger as a compatible integration on your docs/integrations page? Happy to submit a docs PR in whatever format you prefer.

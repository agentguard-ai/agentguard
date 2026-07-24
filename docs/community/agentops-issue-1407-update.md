Update: The integration is built and merged.

### What's available

`tealtiger.integrations.agentops` — exports governance decisions as AgentOps `ActionEvent`/`ErrorEvent` in the session timeline.

```python
import agentops
from tealtiger.integrations.agentops import AgentOpsGovernanceReporter

agentops.init()
reporter = AgentOpsGovernanceReporter()

# Use as on_decision callback with observe()
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI(), on_decision=reporter.report)
# Every governance decision now appears in the AgentOps session timeline
```

### Event mapping

| TealTiger Decision | AgentOps Event | Timeline |
|---|---|---|
| ALLOW | `ActionEvent(action_type="governance:allow")` | Normal action |
| DENY | `ErrorEvent(error_type="governance:deny")` | Red error |
| MONITOR | `ActionEvent(action_type="governance:monitor")` | Warning action |

Event params include: `risk_score`, `reason_codes`, `evaluation_time_ms`, `cost_tracked`, `cumulative_cost`, `pii_count`, `tool_slug`, `agent_id`.

### Source

- Module: [src/tealtiger/integrations/agentops.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/src/tealtiger/integrations/agentops.py)
- Example: [examples/agentops_governance_events.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/examples/agentops_governance_events.py)
- Tests: [tests/test_agentops_integration.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/tests/test_agentops_integration.py)

### Install

```bash
pip install tealtiger agentops
```

Happy to submit a PR adding an example to your `examples/` folder or a docs page if you'd like this listed alongside other integrations. Let me know the preferred format.

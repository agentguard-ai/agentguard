## Issue Title

```
[Integration]: TealTiger — Governance decisions as Langfuse spans
```

## Issue Body

### What

We've built a `tealtiger.integrations.langfuse` module that exports AI agent governance decisions as Langfuse spans — giving teams governance visibility inline with their existing LLM traces.

### How it works

```python
from langfuse import Langfuse
from tealtiger.integrations.langfuse import LangfuseGovernanceExporter

langfuse = Langfuse()
exporter = LangfuseGovernanceExporter(langfuse)

# Each governance decision → Langfuse span
from tealtiger import observe
from openai import OpenAI

client = observe(OpenAI(), on_decision=exporter.trace)
```

Each governance decision becomes a Langfuse span with:

| Field | Value |
|-------|-------|
| `name` | `tealtiger.governance` |
| `level` | `ERROR` (deny), `WARNING` (monitor), `DEFAULT` (allow) |
| `metadata` | action, reason_codes, risk_score, evaluation_time_ms, cost, PII findings |
| `input` | tool/action being governed |
| `output` | governance decision result |

### What is TealTiger?

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0) deterministic governance SDK for AI agents. It provides policy enforcement, PII detection, cost tracking, and audit evidence — with no LLM in the governance path and <5ms overhead.

- [PyPI](https://pypi.org/project/tealtiger/) (4k+ downloads)
- [npm](https://www.npmjs.com/package/tealtiger)
- Already integrated with: [Haystack](https://haystack.deepset.ai/integrations/tealtiger), [AG2](https://github.com/ag2ai/ag2/pull/2962), [Composio](https://github.com/ComposioHQ/composio/pull/3856)

### Why Langfuse?

Teams already using Langfuse for LLM observability want to see governance decisions inline with their traces — without switching tools. The span model maps perfectly: one governance decision = one span with appropriate level coloring.

### Source

- Integration module: [src/tealtiger/integrations/langfuse.py](https://github.com/agentguard-ai/tealtiger-python-prod/tree/main/src/tealtiger/integrations/langfuse.py)
- Example: [examples/langfuse_governance_traces.py](https://github.com/agentguard-ai/tealtiger-python-prod/tree/main/examples/langfuse_governance_traces.py)
- Tests: [tests/test_langfuse_integration.py](https://github.com/agentguard-ai/tealtiger-python-prod/tree/main/tests/test_langfuse_integration.py)

### Ask

Would you be open to listing TealTiger on your community integrations page? Happy to submit a docs PR in whatever format you prefer. We can also add a cookbook/example if that's more appropriate.

## Issue Title

```
[Integration]: TealTiger — Governance evaluation metrics for Opik
```

## Issue Body

### What

We've built `tealtiger.integrations.opik` — a set of custom Opik `BaseMetric` subclasses that evaluate AI agent governance policy correctness. "Did the policy make the right decision given this input?"

### Why Opik?

Opik's evaluation framework is the right tool for governance regression testing. When you change a policy, you need to know: did this change accidentally allow something that was previously blocked (false negative)? Did it block something legitimate (false positive)? Did it slow down?

These are evaluation questions — not observability questions — and Opik's dataset + metric + evaluate() pattern fits perfectly.

### Metrics available

```python
from tealtiger.integrations.opik import (
    GovernanceAccuracyMetric,    # Did governance make the correct ALLOW/DENY decision?
    PIIDetectionMetric,          # True/false positive/negative for PII detection
    FalsePositiveRateMetric,     # Legitimate inputs incorrectly denied
    GovernanceLatencyMetric,     # Evaluation completed within threshold (<5ms)
    GovernanceMultiMetric,       # Combined multi-score (accuracy + PII + latency)
)
```

### Usage with Opik's evaluate()

```python
from opik.evaluation import evaluate
from tealtiger.integrations.opik import GovernanceAccuracyMetric, PIIDetectionMetric

# Define a governance evaluation task
def run_governance(item):
    decision = my_policy.evaluate(item["input"])
    return {"output": decision["action"]}

# Run evaluation
evaluate(
    dataset=governance_test_cases,
    task=run_governance,
    scoring_metrics=[
        GovernanceAccuracyMetric(),
        PIIDetectionMetric(),
    ],
)
```

All metrics are **deterministic** (no LLM judge) — they compare actual governance decisions against expected outcomes in the dataset. This means evaluations are reproducible, fast, and free.

### What is TealTiger?

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0) deterministic governance SDK for AI agents. Policy enforcement, PII detection, cost tracking, and audit evidence — no LLM in the governance path, <5ms overhead.

- [PyPI](https://pypi.org/project/tealtiger/)
- Already integrated with: [Haystack](https://haystack.deepset.ai/integrations/tealtiger), [AG2](https://github.com/ag2ai/ag2/pull/2962), [Composio](https://github.com/ComposioHQ/composio/pull/3856), Langfuse, AgentOps

### Source

- Module: [src/tealtiger/integrations/opik.py](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/src/tealtiger/integrations/opik.py)

### Ask

Would you be open to listing TealTiger governance metrics as a community integration or example in your docs? Happy to submit a PR with an example notebook or docs page.

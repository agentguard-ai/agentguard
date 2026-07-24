# Opik Feature Request

## Title

TealTiger governance evaluation metrics — deterministic policy correctness testing

## Proposal summary

We've built custom Opik `BaseMetric` subclasses that evaluate AI agent governance policy correctness — "Did the policy make the right ALLOW/DENY decision given this input?"

```python
from opik.evaluation import evaluate
from tealtiger.integrations.opik import (
    GovernanceAccuracyMetric,
    PIIDetectionMetric,
    FalsePositiveRateMetric,
    GovernanceLatencyMetric,
)

# Dataset: governance test cases with expected outcomes
dataset = [
    {"input": "Customer SSN: 000-00-0000", "expected_output": "DENY"},
    {"input": "What is the capital of France?", "expected_output": "ALLOW"},
    {"input": "Credit card: 4111-1111-1111-1111", "expected_output": "DENY"},
    {"input": "Summarize this quarterly report", "expected_output": "ALLOW"},
]

# Task: run governance policy on each input
def run_governance(item):
    decision = my_policy.evaluate(item["input"])
    return {"output": decision["action"]}

# Evaluate policy correctness
evaluate(
    dataset=dataset,
    task=run_governance,
    scoring_metrics=[
        GovernanceAccuracyMetric(),       # Correct ALLOW/DENY?
        PIIDetectionMetric(),             # True/false positive/negative?
        FalsePositiveRateMetric(),        # Legitimate inputs incorrectly blocked?
        GovernanceLatencyMetric(),        # Under 5ms threshold?
    ],
)
```

**Use case:** When teams change governance policies, they need regression testing — "did this change accidentally allow PII through?" or "did it start blocking legitimate requests?" These metrics answer that with Opik's evaluate() pipeline.

All metrics are **deterministic** (no LLM judge), fast, and free to run. They compare actual vs. expected decisions from a dataset.

**Source:** [tealtiger.integrations.opik](https://github.com/agentguard-ai/tealtiger-python-prod/blob/main/src/tealtiger/integrations/opik.py)

**About TealTiger:** Open-source (Apache 2.0) deterministic governance SDK for AI agents. Already integrated with Haystack, AG2, Composio, Langfuse, AgentOps. [GitHub](https://github.com/agentguard-ai/tealtiger) | [PyPI](https://pypi.org/project/tealtiger/)

Happy to submit a docs PR or example notebook if you'd like this listed as a community integration.

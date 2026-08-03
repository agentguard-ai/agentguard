# Anthropic TealTiger Integration

This package provides deterministic governance, policy enforcement, PII/secret detection, cost tracking, and structured audit evidence for the Anthropic Python SDK using TealTiger.

## Installation

```bash
pip install anthropic-tealtiger
```

## Features

- **Cost Tracking**: Intercepts token usage to enforce budget limits.
- **Guardrails**: Inspects messages and tool calls for PII, secrets, and policy violations.
- **Seamless Integration**: Drop-in replacement wrapper for `Anthropic` and `AsyncAnthropic` clients.

## Usage

```python
from anthropic_tealtiger import TealAnthropic

client = TealAnthropic(
    api_key="your-anthropic-api-key",
    guardrails={
        "pii_detection": True,
        "secret_detection": True,
    },
    budget={"max_cost_per_session": 5.0}
)

response = client.messages.create(
    model="claude-3-opus-20240229",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=100
)
```

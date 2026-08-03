# Anthropic Agent SDK Governance

TealTiger provides a drop-in middleware for Anthropic's Python SDK, designed specifically to secure agentic workflows, LLM completions, and tool-use (function calling) natively.

Anthropic models (like Claude 3) are exceptionally capable at reasoning and tool execution. Without governance, however, an autonomous agent might leak PII to external APIs, exceed cost budgets, or execute unsafe tools. **TealAnthropic** solves this seamlessly.

## 🚀 Installation

Install the package via pip:

```bash
pip install anthropic-tealtiger
```

Ensure you have a valid Anthropic API key and the base `tealtiger` package installed.

---

## 🛠️ Quickstart

Use `TealAnthropic` exactly as you would use the standard `Anthropic` client. No architectural changes are needed in your LLM code.

```python
import os
from anthropic_tealtiger import TealAnthropic

# 1. Initialize the governed client
# It inherits from Anthropic, meaning it supports all native kwargs
client = TealAnthropic(
    api_key=os.environ["ANTHROPIC_API_KEY"],
    guardrails={
        "secret_detection": True, 
        "pii_detection": True
    },
    budget={
        "max_cost_per_session": 10.00 # Halts execution if costs exceed $10
    },
)

# 2. Define your tools
tools = [
    {
        "name": "query_database",
        "description": "Query the user database",
        "input_schema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
            },
            "required": ["user_id"],
        }
    }
]

# 3. Execute - All tool-use responses are governed automatically
response = client.messages.create(
    model="claude-3-sonnet-20240229",
    messages=[{"role": "user", "content": "Fetch records for John Doe"}],
    tools=tools,
    max_tokens=1024
)
```

---

## ⚙️ How It Works Under the Hood

When Claude decides to call a tool, it returns a `tool_use` block in the response payload. The `TealAnthropic` client intercepts this response *before* returning it to your application. 

It evaluates the requested tool name and its arguments against:
1. **PII and Secret Scanners**: Ensures no sensitive data is passed to external tools.
2. **Policy Engine Rules**: Evaluates standard TealEngine configurations (e.g., allowed tools, regex checks).
3. **Budget Constraints**: Estimates and tracks token consumption natively.

If any governance check fails, a `GovernanceDenyError` is raised immediately. This prevents your application from blindly executing a malicious or non-compliant tool call.

---

## ⚡ Async Support

For high-throughput systems, `anthropic-tealtiger` provides full async support via `AsyncTealAnthropic`.

```python
import asyncio
import os
from anthropic_tealtiger import AsyncTealAnthropic

async def run_agent():
    client = AsyncTealAnthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        budget={"max_cost_per_session": 5.00}
    )
    
    response = await client.messages.create(
        model="claude-3-haiku-20240307",
        messages=[{"role": "user", "content": "Hello Claude!"}],
        max_tokens=500
    )
    print(response.content)

asyncio.run(run_agent())
```

---

## 💰 Automatic Cost Tracking

Unlike standard logging, `TealAnthropic` automatically extracts the `usage` block from Anthropic's response (`input_tokens`, `output_tokens`) and forwards it to the `TealTigerGuard`. This allows your agent to keep a perfectly accurate running total of session costs across multiple turns.

If the cumulative cost exceeds the defined `max_cost_per_session`, the next call will proactively block execution and raise a `GovernanceDenyError(ReasonCode.BUDGET_EXCEEDED)`.

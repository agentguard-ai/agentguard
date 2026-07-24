Update: We've built the `composio-tealtiger` governance middleware package. It uses Composio's native `beforeExecute`/`afterExecute` modifier hooks — no core changes to Composio required.

### Package

📦 **Source:** [packages/composio-tealtiger](https://github.com/agentguard-ai/tealtiger/tree/main/packages/composio-tealtiger)

### Usage

```python
from composio import Composio
from composio_tealtiger import governance_modifiers
from tealtiger import TealEngine

# Zero-config observe mode (track everything, block nothing)
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "slack"],
    **governance_modifiers()
)

# Enforce mode with policies
engine = TealEngine(policies=[
    {"type": "tool_allowlist", "agent": "coder", "allowed": ["GITHUB_*", "HACKERNEWS_*"]},
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
    {"type": "cost_limit", "max_per_session": 5.00},
])

tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "gmail", "slack"],
    **governance_modifiers(engine=engine, mode="ENFORCE", agent_id="coder")
)
# GITHUB_* → ALLOWED
# GMAIL_SEND_EMAIL → DENIED (not in allowlist, never executes)
# SSN in tool args → DENIED (PII blocked before reaching external service)
```

### What it governs

| Capability | How |
|-----------|-----|
| Tool allowlisting | Restrict which tools each agent/role can call (pattern matching) |
| PII detection | Block SSN, credit cards, emails, phone numbers in tool arguments |
| Cost budgets | Per-session cumulative cost limits |
| Kill switch | `freeze("agent_id")` blocks all tool execution instantly |
| Audit trail | Every decision → structured record with correlation ID, <5ms eval |

### How it integrates

Uses Composio's existing modifier system — no changes to Composio core:

```
Agent → Composio → beforeExecute (TealTiger evaluates) → Tool Execution → afterExecute (audit)
                         ↓ (if DENY)
                    GovernanceDenyError (tool never reaches external service)
```

### Tests + Examples

- Full test suite: [`tests/test_governance.py`](https://github.com/agentguard-ai/tealtiger/tree/main/packages/composio-tealtiger/tests/test_governance.py)
- Usage example: [`examples/governed_tool_calls.py`](https://github.com/agentguard-ai/tealtiger/tree/main/packages/composio-tealtiger/examples/governed_tool_calls.py)

---

Happy to submit a docs PR to the Composio repo if you'd like this listed in your integrations page. Just let us know the preferred format and where it should go.

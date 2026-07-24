## feat: Add TealTiger deterministic governance for tool call authorization

Closes #3556

### What this adds

A `composio-tealtiger` governance middleware package that uses Composio's native `beforeExecute`/`afterExecute` modifier hooks to enforce deterministic governance policies before any tool executes against an external service.

### How it works

```python
from composio import Composio
from composio_tealtiger import governance_modifiers
from tealtiger import TealEngine

engine = TealEngine(policies=[
    {"type": "tool_allowlist", "agent": "coder", "allowed": ["GITHUB_*"]},
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
    {"type": "cost_limit", "max_per_session": 5.00},
])

composio = Composio()
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "gmail"],
    **governance_modifiers(engine=engine, mode="ENFORCE", agent_id="coder")
)
# Agent can use GITHUB_* → ALLOWED
# Agent tries GMAIL_SEND_EMAIL → DENIED before execution
```

### What's governed

| Capability | Description |
|-----------|-------------|
| Tool allowlisting | Restrict which tools each agent/role can call |
| PII detection | Block SSN, credit cards, emails, phone numbers in tool arguments |
| Cost governance | Per-session budget limits with cumulative tracking |
| Kill switch | `freeze(agent_id)` immediately blocks all tool execution |
| Audit trail | Every decision produces a structured record with correlation ID |

### Package structure

```
composio-tealtiger/
├── composio_tealtiger/
│   ├── __init__.py
│   └── middleware.py          # beforeExecute/afterExecute governance hooks
├── tests/
│   └── test_governance.py     # Full test suite
├── examples/
│   └── governed_tool_calls.py # Usage examples
├── pyproject.toml
└── README.md
```

### Key design decisions

1. **Uses Composio's existing modifier hooks** — no core changes required
2. **< 5ms overhead** — all evaluation is regex/deterministic, no LLM calls
3. **In-process** — no network calls, no external service dependency
4. **Three modes** — OBSERVE (track only) → MONITOR (log violations) → ENFORCE (block violations)
5. **Zero-config entry point** — `governance_modifiers()` with no arguments gives instant visibility

### Testing

```bash
pip install -e ".[dev]"
pytest tests/
```

Tests cover:
- Observe mode allows all + tracks
- Enforce mode blocks unauthorized tools
- PII detection blocks sensitive data
- Cost limit enforcement
- Audit trail completeness
- Evaluation time < 5ms

### About TealTiger

[TealTiger](https://github.com/agentguard-ai/tealtiger) is open-source (Apache 2.0) deterministic governance for AI agents. Already integrated with:
- [AG2](https://github.com/ag2ai/ag2/pull/2962) (merged)
- [Haystack](https://haystack.deepset.ai/integrations/tealtiger) (listed integration)
- [PyPI](https://pypi.org/project/tealtiger/) / [npm](https://www.npmjs.com/package/tealtiger)

Adds documentation for using TealTiger deterministic governance as a beforeExecute modifier for Composio tool calls.

Closes #3556

### What this adds

A new guide under "Modify tool behavior" showing how to add deterministic governance (policy enforcement, PII detection, cost tracking, kill switch, audit trail) to any Composio tool call using the `composio-tealtiger` package.

### Changes

- New file: `docs/content/docs/tools-direct/modify-tool-behavior/governance-with-tealtiger.mdx`
- Updated: `docs/content/docs/tools-direct/modify-tool-behavior/meta.json` (added page to sidebar)

### How it works

Uses Composio's native `beforeExecute` hook to evaluate governance policies before any tool executes. If denied, the tool never reaches the external service.

```python
from composio_tealtiger import governance_modifiers

tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "gmail"],
    **governance_modifiers(engine=engine, mode="ENFORCE")
)
```

### What's covered in the guide

- Zero-config observe mode (track everything, block nothing)
- Enforce mode with tool allowlisting, PII blocking, cost limits
- Handling denials (GovernanceDenyError)
- Kill switch (freeze/unfreeze)
- Audit trail structure
- Governance modes table

### About TealTiger

Open-source (Apache 2.0) deterministic governance for AI agents. <5ms overhead, no LLM in the governance path. Available on [PyPI](https://pypi.org/project/tealtiger/).

Package source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/composio-tealtiger

---
layout: post
title: "Type-safe AI Governance with Pydantic AI + TealTiger"
description: "How to bring deterministic, type-safe governance to your Pydantic AI agents with TealTiger."
date: 2026-08-02
permalink: /security/integrations/type-safe-ai-governance-with-pydantic-ai/
category: security
hub: integrations
author: Leonardo Franco
author_github: https://github.com/lleonardo-franco
author_role: Contributor

tags:
  - tealtiger
  - pydantic-ai
  - governance
  - type-safety
  - agents
---

# Type-safe AI Governance with Pydantic AI + TealTiger

AI agents are moving from brittle prompts to structured, predictable software engineering. [Pydantic AI](https://github.com/pydantic/pydantic-ai) is leading this charge by bringing strong typing, schema validation, and Python-first correctness to agent development.

But as these agents get deployed to production, a new challenge arises: **How do we govern them with the same rigor?**

Today, we're excited to announce the **TealTiger + Pydantic AI** integration, bringing type-safe, deterministic governance to your Pydantic agents.

## Why Pydantic AI?

Pydantic AI resonates with developers because it focuses on developer experience and correctness. By defining inputs, outputs, and state as Pydantic models, you get:
- IDE autocomplete
- Schema validation
- Type-checked configuration

It only makes sense that governance policies should be expressed the exact same way.

## Introducing GovernedAgent

With the new `pydanticai-tealtiger` package, you can now define your governance policies as fully typed Pydantic models and enforce them at runtime without adding an LLM in the governance path.

### 1. Define your policy as code

Instead of writing English instructions in a system prompt, you define a `GovernanceConfig` model. This gives you instant feedback in your IDE if you misconfigure a policy:

```python
from pydanticai_tealtiger import GovernanceConfig

config = GovernanceConfig(
    mode="enforce",
    allowed_tools=["web_search", "calculator"],
    blocked_pii=["ssn", "credit_card"],
    max_cost_per_session=5.00,
)
```

### 2. Wrap your Agent

Swap out your standard `Agent` with `GovernedAgent`. It inherits from Pydantic AI's `Agent` but automatically injects and enforces your TealTiger policies across all tool calls.

```python
from pydanticai_tealtiger import GovernedAgent

agent = GovernedAgent(
    "openai:gpt-4o-mini",
    governance=config,
)
```

### 3. Build as usual

You don't need to change how you write tools or run your agent. The `GovernedAgent` transparently evaluates every tool invocation against your policy, tracks costs, detects PII, and generates a structured audit trail.

```python
from pydantic_ai import RunContext

@agent.tool
async def web_search(ctx: RunContext, query: str) -> str:
    return f"Searching the web for {query}..."

# Run the agent - governance is automatically enforced!
result = await agent.run("Research ACME Corp")
```

## Zero-latency, deterministic enforcement

Because TealTiger evaluates these policies deterministically, there is **no LLM in the governance path**. Evaluation typically adds less than 2ms of overhead per tool call, making it perfect for high-throughput production agents.

## Get Started

The integration is available today. Check out the [tealtiger repository](https://github.com/agentguard-ai/tealtiger) or view the [example code](https://github.com/agentguard-ai/tealtiger/tree/main/packages/pydanticai-tealtiger/examples) to see it in action.

Bring type safety to your agents with Pydantic AI, and bring type safety to your governance with TealTiger.

---

**Resources:**

- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [TealTiger PyPI](https://pypi.org/project/tealtiger/)
- [Pydantic AI](https://github.com/pydantic/pydantic-ai)
- [Working Example: Governed Agent](https://github.com/agentguard-ai/tealtiger/tree/main/packages/pydanticai-tealtiger/examples)
- [TealTiger Documentation](https://docs.tealtiger.ai/)

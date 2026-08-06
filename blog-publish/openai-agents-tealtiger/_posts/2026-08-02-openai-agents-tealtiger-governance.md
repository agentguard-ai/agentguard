---
layout: post
title: "Governance Middleware for OpenAI Agents SDK: TealTiger Integration"
description: "How combining TealTiger's deterministic policy enforcement with the OpenAI Agents SDK creates production-ready, secure autonomous agents."
author: "Leonardo Franco Lima"
permalink: /integrations/openai-agents-tealtiger-governance/
categories: [Integrations, Governance, OpenAI, Agents]
tags: [openai-agents, tool-use, security, pii]
---

# Governance Middleware for OpenAI Agents SDK: TealTiger Integration

The [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) is rapidly becoming the default framework for teams building with OpenAI models. It abstracts away complex prompt engineering and execution loops, letting you focus on the logic.

However, as these agents become more autonomous, the risk of executing unsafe tools or leaking sensitive data increases. That's why we're excited to announce the **TealTigerGuardrail** integration for the OpenAI Agents SDK.

## Why govern the OpenAI Agents SDK?

By default, agents in the SDK can use tools freely based on their prompt. While this is powerful, enterprise applications require strict guarantees:

- **Cost Control**: Halting the agent if it enters an infinite loop and burns through the budget.
- **PII / Secret Scanning**: Blocking tools from being called with sensitive data (like sending a social security number to a third-party API).
- **Tool Allowlisting**: Ensuring the agent only calls approved tools for a given context.

Our new integration maps directly to the SDK's built-in `Guardrail` concept, providing a pre-execution interceptor for all inputs, outputs, and tool calls.

## How it works

The `TealTigerGuardrail` leverages the OpenAI SDK's `input_guardrails` and `output_guardrails` to seamlessly intercept the agent's actions *before* any tools are executed or responses are finalized.

Here is what a governed agent looks like:

```python
from openai_agents import Agent, Runner
from tealtiger.integrations.openai_agents import TealTigerGuardrail

# 1. Define policies
governance = TealTigerGuardrail(
    policies=["tool_allowlist:web_search,calculator", "pii_block", "cost_limit:5.00"],
    mode="enforce",
)

# 2. Attach to the agent
agent = Agent(
    name="research-agent",
    instructions="You help with research.",
    tools=[web_search, calculator],
    input_guardrails=[governance.input_guard],
    output_guardrails=[governance.output_guard],
)

# 3. Run safely
result = Runner.run_sync(agent, "Find earnings data for ACME Corp")
```

### 1. Pre-execution tool call interception
When the LLM decides to use a tool, the payload is routed to TealTiger. The engine scans the tool name and arguments. If it violates policies (e.g. attempting to use a blocked tool, or passing PII in the arguments), execution is blocked instantly via a `GovernanceDenyError`.

### 2. Message scanning
Any input messages from the user, and any final text output from the agent, are scanned for PII and secrets before reaching the LLM or the end-user.

### 3. Cost Tracking
Native integration means token usage is accumulated properly per-session, ensuring hard stops on budget limits across multi-turn agent conversations.

## Try it out

The integration is available now. Check out the complete source code and examples in the [TealTiger Repository](https://github.com/agentguard-ai/tealtiger/tree/main/packages/openai-agents-tealtiger). 

Install it today:
```bash
pip install openai-agents-tealtiger
```

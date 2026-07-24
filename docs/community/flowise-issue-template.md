# Flowise Issue — TealTiger Governance Node

## Title

Governance node — deterministic PII scanning, cost budgets, and tool authorization as a drag-and-drop chatflow component

---

## Feature Description

A **Governance** node for the Flowise chatflow builder that provides deterministic policy enforcement between any two nodes — PII detection/redaction, per-session cost budget enforcement, tool-call authorization, prompt injection defense, and structured audit evidence. No LLM in the governance path, <2ms per evaluation.

**Node placement in chatflow:**
```
[Chat Input] → [Governance: Input Guard] → [Vector Store Retriever] → [Governance: PII Redact] → [ChatModel] → [Output]
```

**Node configuration:**
- Mode: OBSERVE / MONITOR / ENFORCE
- PII Action: detect / redact / block
- PII Categories: SSN, credit card, email, phone, API key (checkboxes)
- Cost Budget (USD): max per session
- Tool Allowlist: comma-separated tool names (for agent chatflows)
- Injection Defense: on/off

**Node outputs:**
- Passthrough text (allowed content, redacted if configured)
- Decision JSON (correlation_id, action, findings, risk_score, latency_ms)
- Blocked flag (boolean — triggers error output for branching)

---

## Feature Category

Nodes / Components (specifically: a new node category — "Governance" or under "Utilities")

---

## Problem Statement

Three problems deploying Flowise chatflows in regulated environments:

1. **PII in RAG context reaches the LLM unscanned.** Vector store retrievers pull documents containing SSNs, credit cards, and API keys. These flow directly into the ChatModel node. For SOC2/PCI-DSS, I need evidence that PII was evaluated before reaching the model — and optionally redacted.

2. **Agent chatflows with tools have no cost cap.** The Conversational Agent node can loop tool calls indefinitely. I've had sessions burn $30+ because the agent kept retrying a failing API tool. No node exists that hard-stops execution when cumulative cost exceeds a threshold.

3. **No structured compliance evidence per interaction.** Flowise logs execution, but doesn't produce per-node governance records (what was scanned, what was found, what decision was made). Auditors want structured JSON evidence exportable as SARIF or JUnit XML — not raw logs.

---

## Proposed Solution

A new node type (TypeScript, following Flowise's existing node pattern) that wraps [TealTiger](https://github.com/agentguard-ai/tealtiger)'s governance SDK:

```typescript
// packages/components/nodes/governance/TealTigerGovernance/TealTigerGovernance.ts
import { INode, INodeData, INodeParams } from '../../../src/Interface';

class TealTigerGovernance implements INode {
    label = 'TealTiger Governance';
    name = 'tealTigerGovernance';
    type = 'Governance';
    icon = 'tealtiger.svg';
    category = 'Utilities';
    description = 'Deterministic PII scanning, cost budgets, and tool authorization';

    inputs: INodeParams[] = [
        { label: 'Input Text', name: 'input', type: 'string' },
        { label: 'Mode', name: 'mode', type: 'options',
          options: [
            { label: 'Observe', name: 'OBSERVE' },
            { label: 'Monitor', name: 'MONITOR' },
            { label: 'Enforce', name: 'ENFORCE' },
          ]
        },
        { label: 'PII Action', name: 'piiAction', type: 'options',
          options: [
            { label: 'Detect Only', name: 'detect' },
            { label: 'Redact', name: 'redact' },
            { label: 'Block', name: 'block' },
          ]
        },
        { label: 'Max Cost (USD)', name: 'maxCost', type: 'number', default: 5.0 },
    ];
    // ...
}
```

---

## Mockups or References

- Similar component already built for Haystack: https://pypi.org/project/tealtiger-haystack/
- TealTiger TypeScript SDK (would power this node): https://www.npmjs.com/package/tealtiger-ai-sdk
- Flowise node pattern reference: existing nodes in `packages/components/nodes/`

Visual placement would look like any other Flowise node — drag from sidebar, connect between retriever and ChatModel (or between Agent and Tools).

---

## Additional Context

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0, NVIDIA Inception, deterministic governance SDK
- npm: https://www.npmjs.com/package/tealtiger-ai-sdk
- Docs: https://docs.tealtiger.ai
- Already integrated with 12+ AI frameworks (Haystack, CrewAI, AG2, Composio, etc.)
- No other visual AI builder (Langflow, Dify, Flowise) has a governance node — this would be a differentiator for enterprise adoption
- I'm willing to contribute this as a PR following Flowise's node development pattern

# tealtiger-openhands

Deterministic governance hooks for [OpenHands](https://github.com/OpenHands/OpenHands) — file access control, command allowlisting, secret scanning, cost budgets, and structured audit evidence.

**<2ms per evaluation. No LLM in the governance path. Apache 2.0.**

## What it does

`tealtiger-openhands` adds a governance layer to OpenHands agent sessions using the native [PreToolUse hook](https://docs.openhands.dev/openhands/usage/customization/hooks) system. Before any tool executes (terminal commands, file edits, browser actions), the hook evaluates your policy and returns ALLOW or DENY.

| Capability | What it protects |
|---|---|
| **File access control** | Block reads of `.env`, SSH keys, credentials. Restrict writes to approved paths. |
| **Command allowlisting** | Only approved commands execute. Block destructive/network commands. |
| **Secret scanning** | Detect hardcoded API keys, passwords, tokens in file writes before commit. |
| **Network blocking** | Prevent `curl`, `wget`, `ssh` and URL patterns in commands. |
| **Cost budget** | Per-session USD limit + iteration cap. Hard stop when exceeded. |
| **Kill switch** | Instantly freeze a runaway session. |
| **Structured audit** | Every decision logged: correlation_id, action, reason_codes, risk_score, timing. |

## Quick Start

### 1. Install

```bash
pip install tealtiger-openhands
```

### 2. Create governance config

Create `.openhands/governance.yml` in your repository:

```yaml
mode: ENFORCE

file_policy:
  read_denylist:
    - ".env*"
    - "**/*.pem"
    - ".ssh/**"
  write_allowlist:
    - "src/**"
    - "tests/**"

command_policy:
  allowlist:
    - python
    - pytest
    - pip
    - git
    - cat
    - ls
    - grep
  denylist:
    - "rm -rf"
  block_network_access: true

secret_scan:
  enabled: true
  action: block

budget:
  per_session_usd: 5.00
  max_iterations: 100
```

### 3. Register the hook

Create `.openhands/hooks.json`:

```json
{
  "pre_tool_use": [
    {
      "matcher": "*",
      "hooks": [
        {
          "command": "tealtiger-openhands-hook --config .openhands/governance.yml",
          "timeout": 5
        }
      ]
    }
  ]
}
```

### 4. Done

Next time OpenHands works on your repository, every tool call will be evaluated against your governance policy before execution.

## Governance Modes

| Mode | Behavior |
|---|---|
| `ENFORCE` | Block violations. Agent receives denial reason and can adapt. |
| `MONITOR` | Log violations but allow execution. For rollout testing. |
| `OBSERVE` | Passthrough with full audit trail. Zero enforcement. |

Start with `OBSERVE` to see what your agent does, then move to `MONITOR`, then `ENFORCE`.

## How it works

```
Agent decides action → OpenHands PreToolUse hook fires
    → tealtiger-openhands-hook reads event from stdin (JSON)
    → Evaluates against governance.yml policy (<2ms)
    → Outputs decision JSON to stdout
    → Exit 0 (allow) or Exit 2 (block)
        → If blocked: agent gets denial reason, adapts behavior
        → If allowed: tool executes normally
    → Audit record appended to .openhands/.tealtiger-state/audit.jsonl
```

## Programmatic Usage (SDK)

You can also use `tealtiger-openhands` as a Python library alongside the OpenHands SDK:

```python
from openhands.sdk import LLM, Conversation
from openhands.sdk.hooks import HookConfig, HookDefinition, HookMatcher
from openhands.tools.preset.default import get_default_agent

# Register TealTiger as a PreToolUse hook
hook_config = HookConfig(
    pre_tool_use=[
        HookMatcher(
            matcher="*",
            hooks=[
                HookDefinition(
                    command="tealtiger-openhands-hook --config .openhands/governance.yml",
                    timeout=5,
                )
            ],
        )
    ],
)

agent = get_default_agent(llm=llm)
conversation = Conversation(
    agent=agent,
    workspace="/path/to/repo",
    hook_config=hook_config,
)
```

## Decision Contract

Every evaluation produces a structured decision:

```json
{
  "correlation_id": "uuid-v4",
  "timestamp_ms": 1719849600000,
  "action": "DENY",
  "reason": "Command denied: matches denylist pattern 'rm -rf'",
  "reason_codes": ["COMMAND_DENIED"],
  "risk_score": 0.9,
  "policy_version": "1",
  "findings": [],
  "evaluation_time_ms": 0.8,
  "tool_name": "terminal",
  "session_id": "abc-123"
}
```

## Audit Trail

All decisions are logged to `.openhands/.tealtiger-state/audit.jsonl` (one JSON record per line). Use this for SOC2/HIPAA compliance evidence.

## Related

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Core governance SDK
- [OpenHands Hooks Docs](https://docs.openhands.dev/openhands/usage/customization/hooks) — Hook system reference
- [GitHub Issue #4273](https://github.com/OpenHands/software-agent-sdk/issues/4273) — Feature proposal

## License

Apache 2.0

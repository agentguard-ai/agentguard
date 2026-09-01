# DeepSeek Harness Governance

TealTiger integrates with DeepSeek Harness as a Cordis plugin. It evaluates
tool calls before execution and prevents agents or newly installed plugins
from bypassing governance policy.

The integration package is located at `packages/tealtiger-harness`.

## How it works

The plugin participates in the Harness tool-execution pipeline:

```text
Agent requests tool
        ↓
tools/pre-execute
        ↓
TealTiger policy, sensitive-data, and budget checks
        ↓
TEEC governance receipt
        ↓
Final monotonic guard
        ↓
Tool allowed or denied
```

The final Cordis guard runs after extensible pre-execution hooks. Once
TealTiger denies an execution, a later plugin cannot change that decision
back to an allow.

## Installation

```bash
npm install tealtiger-harness tealtiger
```

The package exposes a Harness bundle patch through its `dsh.bundle.patch`
manifest.

## Configuration

```yaml
- insert:
    - id: tealtiger-harness
      name: tealtiger-harness
      config:
        mode: ENFORCE
        allowedTools:
          - read_file
          - search
        frozenTools:
          - shell
        piiDetection: true
        secretDetection: true
        sessionBudgetUsd: 1
        defaultToolCostUsd: 0.01
        toolCostsUsd:
          search: 0.02
```

An empty `allowedTools` list denies every tool in ENFORCE mode. Use `"*"` to
allow every tool while retaining sensitive-data, budget, and FREEZE checks.

When `sessionBudgetUsd` is configured, `defaultToolCostUsd` is required.
Values in `toolCostsUsd` override the default for individual tools.

## Governance modes

| Mode | Behaviour |
| --- | --- |
| `ENFORCE` | Policy, sensitive-data, and budget violations are denied. |
| `MONITOR` | Violations are recorded but execution is allowed. |
| `REPORT_ONLY` | Sensitive-data scanning and allowlist enforcement are skipped while decisions and costs remain observable. |

FREEZE rules are enforced in every mode.

## Sensitive-data protection

Before a tool executes, TealTiger serializes and scans its arguments for:

- Personally identifiable information
- API keys and common secret formats

Receipts contain sanitized reason codes such as `PII_DETECTED` and
`SECRET_DETECTED`. The detected values are never copied into receipt reasons.

## Tool allowlists and FREEZE

`allowedTools` controls which tools may execute in ENFORCE mode.

`frozenTools` is stronger than the allowlist. A frozen tool is denied even
when:

- The allowlist contains `"*"`
- Governance is in MONITOR mode
- Governance is in REPORT_ONLY mode
- Another plugin attempts to permit the execution

## Session budgets

The plugin tracks estimated tool cost using integer micro-USD values to avoid
floating-point accounting errors.

A tool-specific cost is used when present. Otherwise,
`defaultToolCostUsd` is used.

In ENFORCE mode, a call that would exceed `sessionBudgetUsd` is denied and
does not increase the session total.

## Audit receipts

Every evaluation emits a `tealtiger/decision` Cordis event:

```ts
ctx.on('tealtiger/decision', (receipt) => {
    console.log(receipt.action);
    console.log(receipt.reason_code);
    console.log(receipt.correlation_id);
    console.log(receipt.cost.session_total_usd);
});
```

Receipts are immutable and include:

- Action and governance mode
- Sanitized reason codes
- Risk score
- Policy and component versions
- Agent, session, and correlation identifiers
- Estimated call cost and session total

Applications can consume this event to persist receipts in their audit
storage.

## Cordis service

The plugin registers `ctx.tealtiger` for use by other Cordis plugins:

```ts
export const inject = ['tealtiger'];

export function apply(ctx: Context): void {
    if (ctx.tealtiger.isFrozen('shell')) {
        throw new Error('The shell tool is frozen');
    }
}
```

The service exposes:

- `ctx.tealtiger.mode`
- `ctx.tealtiger.engine`
- `ctx.tealtiger.isAllowed(toolName)`
- `ctx.tealtiger.isFrozen(toolName)`
- `ctx.tealtiger.evaluateTool(execution)`

## Development verification

```bash
cd packages/tealtiger-harness
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

See [issue #487](https://github.com/agentguard-ai/tealtiger/issues/487) for
the integration requirements.

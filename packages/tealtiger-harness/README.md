# tealtiger-harness

TealTiger governance plugin for DeepSeek Harness and its Cordis plugin system.

It evaluates tool calls before execution and provides:

- Tool allowlists
- Immutable FREEZE rules
- PII detection
- Secret detection
- Per-session budget limits
- ENFORCE, MONITOR, and REPORT_ONLY modes
- Immutable TEEC governance receipts

## Installation

```bash
npm install tealtiger-harness tealtiger
```

## Harness configuration

The package includes a Harness bundle patch through its `dsh.bundle.patch`
manifest.

Example configuration:

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

In ENFORCE mode, an empty `allowedTools` list denies every non-frozen tool.
Use `"*"` to allow every tool while retaining PII, secret, budget, and FREEZE
checks.

## Governance modes

| Mode | Behaviour |
| --- | --- |
| ENFORCE | Policy violations are denied. |
| MONITOR | Violations are recorded but execution is allowed. |
| REPORT_ONLY | Policy decisions are reported without active scanning or enforcement. |

FREEZE rules always deny execution, regardless of the selected mode.

## Audit receipts

Every evaluated tool call emits a `tealtiger/decision` Cordis event.

```ts
ctx.on('tealtiger/decision', (receipt) => {
    console.log(receipt.action);
    console.log(receipt.reason_code);
    console.log(receipt.correlation_id);
});
```

Receipts contain policy metadata, risk score, session cost information, and
sanitized reason codes. Detected PII and secret values are never included.

## Consuming the service

Other Cordis plugins can consume the registered service:

```ts
export const inject = ['tealtiger'];

export function apply(ctx: Context): void {
    if (!ctx.tealtiger.isAllowed('search')) {
        throw new Error('Search is not allowed by the governance policy');
    }
}
```

The underlying TealTiger engine is available through:

```ts
ctx.tealtiger.engine
```

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

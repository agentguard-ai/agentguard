# TealTiger Contracts

Canonical, versioned governance contracts shared by the TealTiger TypeScript and Python ecosystems.

The JSON Schemas in `schemas/` are the source of truth. Generated language models, strict validation utilities, and the shared conformance vectors are derived from those schemas. This package is intentionally separate from SDK runtime behavior and uses its own semantic version.

## Contracts

| Contract | Purpose |
| --- | --- |
| `Action` | Describes one consequential action intent without embedding raw parameters. |
| `Decision` | Records public `ALLOW`, `DENY`, or `REFER` outcome separately from the internal gate. |
| `Approval` | Binds one approver, tenant, policy digest, nonce, and expiry to one exact action hash. |
| `ExecutionReceipt` | Links a decision and optional approval to an observed execution outcome. |
| `TargetCapability` | Declares connector enforcement, approval, reconciliation, and compensation capabilities. |

The design-time reversibility vocabulary is:

- `read_only`
- `reversible`
- `externally_reversible`
- `irreversible`

The internal gate ladder is `AUTO`, `AUDIT`, `REFER`, `BLOCK`. The public outcome vocabulary remains `ALLOW`, `DENY`, `REFER`.

## TypeScript

```ts
import { validateAction } from '@tealtiger/contracts';

const action = validateAction(JSON.parse(payload));
console.log(action.action_id);
```

Validation is strict and does not coerce values. The returned object keeps unknown fields so a version 1 consumer can relay extensions introduced by a later compatible minor release.

## Python

```python
from tealtiger_contracts import serialize_contract, validate_action

action = validate_action(payload)
wire_value = serialize_contract(action)
```

The generated Pydantic models use strict primitive fields and allow unknown fields. Known optional properties may be omitted but cannot be set to `null` unless their schema explicitly permits it. Assignment is validated, and `serialize_contract()` revalidates the complete model before emitting the JSON-compatible shape without adding omitted optional fields.

## Generate

From `packages/tealtiger-contracts`:

```bash
npm ci
npm run generate

python -m pip install -e "python[dev]"
python scripts/generate_python.py
```

Generated files are committed. CI regenerates both language surfaces and fails if the checked-in files are stale.

## Verify

```bash
npm run verify
python scripts/generate_python.py --check
python -m pytest python/tests
```

Both suites read `vectors/conformance.json`. Every valid vector must survive a JSON round trip without losing unknown fields, and every invalid vector must fail with a field-specific error.

## Security Boundaries

- Producers must assign a reversibility class at design time. An unclassified operation must be treated as `irreversible` before an `Action` is emitted; omission is invalid.
- Approval scope in contract version 1 is fixed to `EXACT_ACTION`. Approval satisfies a gate but never lowers a floor set by reversibility, policy, risk, failure state, or freeze state.
- A receipt proves the integrity of a recorded service event only when paired with the future signing layer. It does not by itself prove complete mediation, a trustworthy producer, personal non-repudiation, or that a target action occurred. Native target-event reconciliation remains necessary.
- Hash and digest strings are opaque in version 1 so producers can use algorithm-prefixed representations without an early wire-format break.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the contract evolution policy.

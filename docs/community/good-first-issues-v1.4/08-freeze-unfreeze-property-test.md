---
title: "[testing] Add property-based test for freeze/unfreeze toggling"
labels: good first issue, testing, observe-mode
---

## Summary

Add a fast-check property test proving that `freeze(agentId)` followed by `unfreeze(agentId)` restores the agent to operational state.

## What to do

- Create `src/observe/__tests__/freeze-registry.property.test.ts`
- Use `fast-check` (already a dev dependency)
- Test properties:
  1. For any agentId: `freeze(id)` → `isFrozen(id) === true`
  2. For any agentId: `freeze(id)` → `unfreeze(id)` → `isFrozen(id) === false`
  3. Freezing one agent doesn't affect another agent's state
- Run 100 iterations per property

## Example structure

```typescript
import fc from 'fast-check';
import { freeze, unfreeze, isFrozen } from '../freeze-registry';

describe('FreezeRegistry (property-based)', () => {
  it('freeze then unfreeze restores operational state', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (agentId) => {
        freeze(agentId);
        expect(isFrozen(agentId)).toBe(true);
        unfreeze(agentId);
        expect(isFrozen(agentId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
```

## Acceptance criteria

- [ ] Property test file created
- [ ] All 3 properties pass with 100 iterations
- [ ] Tests run with `npx vitest run src/observe/__tests__/freeze-registry.property.test.ts`
- [ ] No flaky failures

## Helpful links

- Freeze registry: `src/observe/freeze-registry.ts`
- fast-check docs: https://github.com/dubzzz/fast-check
- Existing property tests: `dashboard/web/src/utils/formatters.test.ts` (for pattern)

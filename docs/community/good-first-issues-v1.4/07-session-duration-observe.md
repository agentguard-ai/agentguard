---
title: "[observe] Add session duration to ObserveCostSummary"
labels: good first issue, enhancement, observe-mode
---

## Summary

Add `sessionDurationMs: number` to the `ObserveCostSummary` type — time elapsed since `observe()` was called.

## What to do

- Record `Date.now()` when `observe()` creates the proxy
- Compute duration in `getCost()` as `Date.now() - startTime`
- Add `sessionDurationMs` to the returned `ObserveCostSummary` object
- Update the type definition
- Add unit test

## Expected behavior

```typescript
const client = observe(new OpenAI());
// ... wait 5 seconds, make some calls ...
const cost = client.getCost();
console.log(cost.sessionDurationMs); // ~5000
```

## Acceptance criteria

- [ ] `sessionDurationMs` field added to `ObserveCostSummary` interface in `src/observe/types.ts`
- [ ] Value computed correctly as `Date.now() - proxyCreationTime`
- [ ] Unit test verifies duration is > 0 and approximately correct
- [ ] Doesn't break existing `getCost()` consumers (additive change)

## Helpful links

- Types: `src/observe/types.ts` → `ObserveCostSummary`
- Observe entry point: `src/observe/observe.ts`
- Cost accumulator: `src/observe/cost-accumulator.ts`

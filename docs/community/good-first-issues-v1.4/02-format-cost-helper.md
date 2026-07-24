---
title: "[observe] Add getCost() formatted output helper"
labels: good first issue, enhancement, observe-mode
---

## Summary

Add a `formatCost(summary: ObserveCostSummary): string` utility that pretty-prints cost data for terminal output.

## What to do

- Create `src/observe/format-cost.ts`
- Format output: `"$0.0023 (2 requests) | Input: $0.0018 | Output: $0.0005"`
- Export from `tealtiger/observe`
- Add unit test in `src/observe/__tests__/format-cost.test.ts`

## Expected behavior

```typescript
import { observe } from 'tealtiger';
import { formatCost } from 'tealtiger/observe';

const client = observe(new OpenAI());
// ... make some calls ...
console.log(formatCost(client.getCost()));
// Output: "$0.0023 (2 requests) | Input: $0.0018 | Output: $0.0005"
```

## Acceptance criteria

- [ ] `formatCost()` exported from `tealtiger/observe`
- [ ] Handles zero-cost case gracefully: `"$0.00 (0 requests)"`
- [ ] Handles pricing gaps: appends `" (estimated)"` when `hasPricingGaps === true`
- [ ] Unit test with at least 3 cases (zero, normal, pricing gap)
- [ ] No external dependencies

## Helpful links

- Type definition: `src/observe/types.ts` → `ObserveCostSummary`
- Existing formatters: `dashboard/web/src/utils/formatters.ts` (for reference pattern)

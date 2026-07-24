---
title: "[observe] Add observe() example for Anthropic Claude"
labels: good first issue, documentation, observe-mode
---

## Summary

Add an example script showing `observe()` wrapping an Anthropic Claude client.

## What to do

- Create `examples/observe-anthropic.ts` and `examples/observe_anthropic.py`
- Wrap `new Anthropic()` with `observe()`, make one chat call, print `getCost()`
- Follow the same pattern as `examples/observe-quickstart.ts`

## Example structure

```typescript
import { observe } from 'tealtiger';
import Anthropic from '@anthropic-ai/sdk';

const client = observe(new Anthropic());

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello Claude!' }],
});

console.log(response.content);
console.log(client.getCost());
```

## Acceptance criteria

- [ ] TypeScript example runs locally
- [ ] Python example runs locally
- [ ] Both print cost summary
- [ ] No API key required for the PR review (mock or placeholder is fine in tests)
- [ ] README in examples folder updated to reference the new files

## Helpful links

- Existing example: `examples/observe-quickstart.ts`
- Provider detector: `src/observe/provider-detector.ts`
- Anthropic SDK: https://github.com/anthropics/anthropic-sdk-node

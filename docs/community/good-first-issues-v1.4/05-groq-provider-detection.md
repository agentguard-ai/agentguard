---
title: "[observe] Verify Groq provider detection in observe()"
labels: good first issue, enhancement, observe-mode
---

## Summary

Verify that `observe()` correctly detects and instruments a Groq client instance via duck-typing. Add test coverage.

## What to do

- Check `src/observe/provider-detector.ts` handles Groq's client shape
- Add a unit test in `src/observe/__tests__/provider-detector.test.ts` with a mocked Groq-like object
- If detection fails, add the duck-typing rule for Groq

## Context

The provider detector uses duck-typing (checking for specific method signatures) rather than `instanceof` to identify which LLM provider a client belongs to. Each provider has a unique "signature" the detector looks for.

Groq's SDK is OpenAI-compatible but has slightly different internal structure. We need to ensure it's correctly identified as `'groq'` rather than falling through to `'openai'`.

## Acceptance criteria

- [ ] Unit test passes with a mocked Groq client object
- [ ] `detectProvider(groqClient)` returns the correct `ProviderSignature` with `provider: 'groq'`
- [ ] If Groq wasn't detected before, the fix doesn't break existing provider detection
- [ ] Test file: `src/observe/__tests__/provider-detector.test.ts`

## Helpful links

- Provider detector: `src/observe/provider-detector.ts`
- Groq SDK: https://github.com/groq/groq-node
- Existing tests: check the `__tests__` folder for the pattern

---
title: "[docs] Add observe() quickstart page to docs.tealtiger.ai"
labels: good first issue, documentation
---

## Summary

The docs site needs a proper quickstart guide for the `observe()` feature shipped in v1.4.

## What to do

- Edit or create `TealTiger-Docs/concepts/observe-mode.mdx`
- Show TypeScript + Python examples side by side
- Explain: what `observe()` does, what `getCost()` returns, what `freeze()` does
- Add the progressive disclosure table (Level 0-3)
- Keep it under 200 lines

## Page structure

1. **One-liner** — what observe() is (1 sentence)
2. **Install** — npm/pip commands
3. **TypeScript example** — 5 lines
4. **Python example** — 5 lines
5. **What you get automatically** — bullet list of capabilities
6. **getCost() response shape** — show the ObserveCostSummary fields
7. **freeze() / unfreeze()** — kill switch usage
8. **Supported providers** — list of 12
9. **Performance** — under 5ms, in-process, offline-capable
10. **Next steps** — link to guardrails, policies, dashboard

## Acceptance criteria

- [ ] Page renders correctly on docs.tealtiger.ai (Mintlify MDX format)
- [ ] TypeScript and Python examples are both present
- [ ] No broken links
- [ ] Added to navigation in `docs.json` if not already present

## Helpful links

- Docs repo: https://github.com/agentguard-ai/TealTiger-Docs
- Existing nav: check `docs.json` for the "Core Concepts" section
- Source reference: `packages/tealtiger-sdk/src/observe/`

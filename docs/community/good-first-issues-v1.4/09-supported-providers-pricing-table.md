---
title: "[docs] Add supported providers table with pricing coverage to observe() docs"
labels: good first issue, documentation, observe-mode
---

## Summary

Document which of the 12 providers have full pricing data vs. estimated pricing in observe mode.

## What to do

- Create a table in the observe mode docs page (or a standalone page)
- Columns: Provider | Cost Tracking | Pricing Source | Notes
- Check `src/observe/cost-accumulator.ts` or `src/cost/pricing.ts` for actual coverage
- Mark each provider as: ✅ Full pricing | ⚠️ Estimated | ❌ No pricing

## Expected table

| Provider | Cost Tracking | Pricing Source | Notes |
|----------|:---:|---|---|
| OpenAI | ✅ | Official API pricing | GPT-4, GPT-4o, GPT-3.5 |
| Anthropic | ✅ | Official pricing | Claude 3.5, Claude 3 |
| Google Gemini | ✅ | Official pricing | Multimodal |
| AWS Bedrock | ⚠️ | Estimated | Varies by model |
| Azure OpenAI | ✅ | Same as OpenAI | Deployment-based |
| Cohere | ✅ | Official pricing | Chat, RAG |
| Mistral | ✅ | Official pricing | |
| DeepSeek | ⚠️ | Community pricing | Cost-efficient |
| Groq | ✅ | Official pricing | Ultra-low latency |
| Together AI | ⚠️ | Estimated | Open-source models |
| HuggingFace TGI | ❌ | N/A (self-hosted) | No external pricing API |
| xAI (Grok) | ⚠️ | Estimated | Limited public pricing |

(Verify against actual source code — this table is a starting point)

## Acceptance criteria

- [ ] Table added to observe mode documentation
- [ ] Each provider's status verified against source code
- [ ] Notes explain any limitations
- [ ] Page renders correctly in Mintlify

## Helpful links

- Pricing data: `src/cost/pricing.ts`
- Cost accumulator: `src/observe/cost-accumulator.ts`
- Docs repo: https://github.com/agentguard-ai/TealTiger-Docs

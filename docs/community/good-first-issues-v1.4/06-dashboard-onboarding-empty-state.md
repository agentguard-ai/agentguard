---
title: "[dashboard] Show onboarding message when KPI values are all zero"
labels: good first issue, enhancement, dashboard
---

## Summary

When the dashboard loads with an empty database (no governance events yet), KPIs show "0" which looks broken. Show a helpful onboarding message instead.

## What to do

- In `dashboard/web/src/components/KPIBanner/KPIBannerRow.tsx`
- Detect when all 4 KPI values are zero (totalRequests=0, totalCost=0, denials=0)
- Show a friendly banner instead of the zero-value cards:
  - "No governance data yet. Run `observe(client)` to start tracking."
  - Include a link to the quickstart docs
- Keep the zero-value cards as fallback if only some values are zero

## Design

```
┌─────────────────────────────────────────────────────────┐
│  🔭 No governance data yet                              │
│                                                         │
│  Run observe(client) to start tracking your AI agents.  │
│  [Get Started →]                                        │
└─────────────────────────────────────────────────────────┘
```

## Acceptance criteria

- [ ] Onboarding message shows when all KPIs are zero
- [ ] Normal KPI cards show when any value is non-zero
- [ ] "Get Started" link points to docs or quickstart
- [ ] Message is accessible (proper heading level, link has descriptive text)
- [ ] Unit test covers the zero-state detection

## Helpful links

- KPI component: `dashboard/web/src/components/KPIBanner/KPIBannerRow.tsx`
- Existing tests: `dashboard/web/src/components/KPIBanner/KPIBannerRow.test.tsx`

---
title: "[dashboard] Add empty state illustration for Canary Alerts panel"
labels: good first issue, enhancement, dashboard
---

## Summary

The Canary Alerts panel shows a text-only empty state when no alerts exist. Add a small SVG illustration to make it more visually engaging.

## What to do

- Create a simple SVG illustration (shield with checkmark, or calm tiger, or "all clear" icon)
- Add to `dashboard/web/src/components/EmptyState/` or inline in the component
- Render above the text in the Canary Alerts empty state
- Keep SVG under 2KB, single color using CSS variables

## Design guidelines

- Use `var(--color-text-secondary)` for stroke color so it works in both themes
- Max dimensions: 80x80px
- Style: minimal line art, consistent with the dashboard's clean aesthetic
- Accessible: include `aria-hidden="true"` on decorative SVG

## Acceptance criteria

- [ ] SVG renders in the Canary Alerts empty state
- [ ] Works in both light content area and dark sidebar context
- [ ] Doesn't break layout on narrow viewports
- [ ] Under 2KB file size

## Helpful links

- Empty state component: `dashboard/web/src/components/EmptyState/`
- Canary panel: `dashboard/web/src/panels/CanaryAlertsPanel.tsx`
- Design reference: similar dashboards use simple line illustrations for empty states

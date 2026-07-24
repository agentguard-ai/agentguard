---
title: "[dashboard] Add dark mode toggle to Governance Dashboard"
labels: good first issue, enhancement, dashboard
---

## Summary

The dashboard currently has a light content area with dark sidebar. Add a toggle to switch the content area back to full dark mode for users who prefer it.

## What to do

- Add a toggle button in the header bar (sun/moon icon)
- Toggling removes the `content-area` class from `<main>` (falls back to `:root` dark CSS vars)
- Persist preference in `localStorage` under key `tealtiger-theme`
- Keep sidebar always dark regardless of toggle state

## Implementation hints

- Header bar: `dashboard/web/src/components/HeaderBar/HeaderBar.tsx`
- Layout: `dashboard/web/src/app/(dashboard)/layout.tsx` — the `content-area` class controls the light theme
- CSS vars: `dashboard/web/src/app/globals.css` — `:root` has dark defaults, `.content-area` overrides to light

## Toggle logic

```typescript
// Simple toggle
const [isDark, setIsDark] = useState(() => localStorage.getItem('tealtiger-theme') === 'dark');

useEffect(() => {
  const main = document.querySelector('main');
  if (isDark) {
    main?.classList.remove('content-area');
  } else {
    main?.classList.add('content-area');
  }
  localStorage.setItem('tealtiger-theme', isDark ? 'dark' : 'light');
}, [isDark]);
```

## Acceptance criteria

- [ ] Sun/moon toggle button visible in header bar
- [ ] Clicking toggles between light and dark content area
- [ ] Sidebar remains dark in both modes
- [ ] Preference persists across page reloads via localStorage
- [ ] Toggle is keyboard accessible (Enter/Space)
- [ ] Has `aria-label` describing current state

## Helpful links

- Header: `dashboard/web/src/components/HeaderBar/HeaderBar.tsx`
- Layout: `dashboard/web/src/app/(dashboard)/layout.tsx`
- CSS: `dashboard/web/src/app/globals.css`

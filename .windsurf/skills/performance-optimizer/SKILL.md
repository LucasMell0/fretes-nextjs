---
name: performance-optimizer
description: Optimize UI and data-layer performance in React/Next apps (shadcn). Use when reviewing components, pages, lists, tables, forms, dashboards, modals, or any performance complaint (slow load, laggy typing, janky scroll).
---

You optimize performance by default, without hurting UX, readability, or correctness.

## When to apply
- Any UI component/page with: lists/tables, filters/search, charts, editors, modals, or repeated renders.
- Any report of: slow initial load, janky scrolling, input lag, excessive network calls, hydration issues.
- Any code review involving: state management, data fetching, derived data, rendering conditions.

## Output expectations
When optimizing, produce:
1) A short diagnosis (what is slow + why).
2) Concrete changes (code-level guidance).
3) Trade-offs (what we gain/what we might lose).
4) A quick verification plan (how to confirm improvement).

## Default priorities (in order)
1) Prevent unnecessary renders (render graph).
2) Reduce work per render (CPU + allocations).
3) Reduce data transferred and fetched (network).
4) Improve perceived performance (loading states, skeletons).
5) Avoid premature micro-optimizations.

## Rules of thumb
- Prefer server components and server-side data fetching when possible.
- Keep client components small; move heavy logic to server or isolated hooks.
- Avoid storing derived data in state; derive with memoization or pure computation.
- Avoid re-creating functions/objects/arrays inside render when passed to children.
- Avoid deep prop drilling in hot paths; use context carefully and split providers.
- Do not add memoization everywhere. Only where it prevents real re-renders or expensive computation.

## React/Next patterns
### Reduce re-renders
- Split components: separate "container" (data/state) from "presentational" (pure UI).
- Use `React.memo` for leaf components that receive stable props and rerender often.
- Use `useCallback` / `useMemo` only to stabilize props for memoized children OR avoid expensive recalculations.
- Keep state local to the smallest subtree that needs it.
- Prefer `useRef` for mutable values that should not trigger renders (timers, previous values, imperatives).

### Expensive lists and tables
- Pagination by default for large datasets.
- Virtualize long lists (react-window / @tanstack/react-virtual) when needed.
- Use stable keys (never index key if list is mutable).
- Avoid rendering hidden rows; conditionally mount instead of CSS hiding.

### Data fetching
- Deduplicate requests: cache (React Query/SWR) or server caching.
- Batch endpoints when it reduces round-trips.
- Avoid fetching on every keystroke; debounce search and use query keys properly.
- Use `select`/projection: request only needed fields.

### Rendering and hydration
- Avoid making large pages `"use client"`; isolate client islands.
- Use dynamic import for heavy/rare components (charts, editors).
- Keep initial HTML meaningful (skeletons, placeholders) and avoid layout shift.

### Forms and typing lag
- Use uncontrolled inputs where possible + validate on blur/submit.
- Debounce expensive validations and requests.
- Avoid updating large parent state on each keystroke; isolate field state.

## Avoid heavy client-side logic
If something can run on the server, do it:
- filtering/sorting of large datasets (server or DB)
- report aggregation and metrics
- permission checks
- expensive transformations

## shadcn-specific guidance
- Prefer composing existing shadcn components instead of custom heavy abstractions.
- Avoid nesting many Dialog/Popover/Dropdown with large children; mount content on open when possible.
- Keep tables lightweight; render only visible columns and rows.

## Diagnostic checklist (use quickly)
- Are we passing new inline objects/functions causing child rerenders?
- Is state higher than necessary, rerendering big subtrees?
- Any expensive compute inside render (map/filter/sort on big arrays)?
- Any effect firing too often (missing deps, unstable deps)?
- Too many network calls (per render, per keystroke, per focus)?
- Hydration mismatch or huge client bundle?

## Verification plan
- Confirm rerender reduction with React DevTools (Highlight updates).
- Confirm CPU work with Performance tab (long tasks).
- Confirm network reduction with DevTools (requests count/size).
- Confirm bundle impact (Next build analyzer if available).

## Guardrails
- Never degrade accessibility.
- Never remove loading feedback.
- Never introduce stale UI or caching bugs without clear invalidation rules.
- If unsure, choose the safer optimization and document it.
---
description: Quick, AI-friendly reference for core Retend patterns and imports.
---

# Quick Reference

## Cells

| Action | Use | Notes |
| --- | --- | --- |
| Read in JSX | `{cell}` | Pass the Cell directly |
| Read in derived | `cell.get()` | Tracks dependency |
| Read in derivedAsync | `get(cell)` | Tracks dependency |
| Read without tracking | `cell.peek()` | No dependency |
| Update | `cell.set(value)` | Only on source cells |
| Listen | `cell.listen(fn)` | Call in component body |

## Control Flow

| Scenario | Use |
| --- | --- |
| 2 branches | `If(cond, { true, false })` |
| 1 branch | `If(cond, { true })` |
| 3+ branches | `Switch(value, cases, default)` |
| Switch on prop | `Switch.OnProperty(obj, 'key', cases, default)` |
| Lists | `For(list, (item, index) => ...)` |

## Routing

| Task | Use |
| --- | --- |
| Navigate | `router.navigate('/path')` |
| Replace | `router.replace('/path')` |
| Link | `<Link href="/path">` |
| Params | `useRouteParams()` (Cells) |
| Query | `useRouteQuery()` (mutations are async) |

## Imports

```tsx
// Core
import { Cell, If, For, Switch, onSetup, onConnected, setActiveRenderer } from 'retend';

// Router
import { Router, Link, Outlet, createRouterRoot, useRouter, useCurrentRoute } from 'retend/router';

// Web
import { DOMRenderer, Teleport, ShadowRoot } from 'retend-web';

// Utils
import { Input, FluidList, createUniqueTransition } from 'retend-utils/components';
import { useMatchMedia, useWindowSize, useLocalStorage } from 'retend-utils/hooks';
```

## Decision Tree: Reading a Cell

```
Where are you reading the Cell?
├─ JSX → Pass Cell directly (no .get())
├─ Cell.derived() → Use .get() (tracks dependency)
├─ Cell.derivedAsync() → Use get(cell) parameter
├─ Event handler → Use .get() for current value
└─ No dependency needed → Use .peek()
```

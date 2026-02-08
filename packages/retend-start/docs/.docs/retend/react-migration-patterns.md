---
description: Critical rules for React developers migrating to Retend. Prevents the most common mistakes when LLMs revert to React patterns.
---

# React to Retend Migration Patterns

**Purpose**: This guide prevents React-trained LLMs from using React patterns in Retend.

**CRITICAL PRINCIPLE**: Retend does NOT use React hooks, virtual DOM, or component re-rendering. Components run ONCE. Updates happen through Cells.

---

## [CRITICAL] NEVER Use React Hooks

**Applies to**: All component definitions

**Rule**: Do NOT import or use any React hooks. They do not exist in Retend.

**DO NOT use**:
- `useState` → Use `Cell.source()`
- `useEffect` → Use `onSetup()` (runs once) or `cell.listen()`
- `useMemo` → Use `Cell.derived()`
- `useCallback` → Use plain functions (no memoization needed)
- `useRef` → Use `Cell.source(null)`
- `useContext` → Use `createScope()` + `useScopeContext()`

**Correct Pattern**:
```tsx
// WRONG - React hooks
import { useState, useEffect } from 'react';
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => { console.log(count); }, [count]);
  return <div>{count}</div>;
}

// CORRECT - Retend patterns
import { Cell } from 'retend';
function Counter() {
  const count = Cell.source(0);
  
  // Listeners are called directly in component body
  // Automatic cleanup - no onSetup wrapper needed
  count.listen((value) => {
    console.log('Count:', value);
  });
  
  return <div>{count}</div>; // Pass Cell directly
}
```

**Why this matters**: Using React hooks causes runtime errors. Retend has no React dependency.

---

## [CRITICAL] NEVER Call .get() Inside JSX

**Applies to**: All JSX expressions using Cell values

**Rule**: Pass Cell objects directly to JSX. Never call `.get()` in JSX.

**Decision Tree**:
```
USING A CELL VALUE IN JSX?
├─ YES → Pass cell directly: {cellName}
└─ NO (in callback/derived/etc.)
   ├─ IN Cell.derived() or Cell.derivedAsync()
   │  └─ YES → Use cellName.get() to track dependency
   └─ OTHERWISE
      └─ Use cellName.peek() to read without tracking
```

**Correct Pattern**:
```tsx
function Display() {
  const count = Cell.source(0);
  
  // WRONG - breaks reactivity
  return <div>{count.get()}</div>; // Static snapshot, never updates
  
  // CORRECT - reactive updates
  return <div>{count}</div>; // Framework subscribes to changes
}
```

**Why this matters**: `.get()` returns a static value. Passing the Cell lets Retend subscribe to updates.

---

## [CRITICAL] NEVER Use Dependency Arrays

**Applies to**: `Cell.derived()`, `onSetup()`

**Rule**: Retend tracks dependencies automatically. Never provide dependency arrays.

**Correct Pattern**:
```tsx
const count = Cell.source(0);

// WRONG - dependency arrays don't exist
const doubled = Cell.derived(() => count.get() * 2, [count]);
onSetup(() => { ... }, [count]);

// CORRECT - automatic dependency tracking
const doubled = Cell.derived(() => count.get() * 2);
// ^ Automatically knows count is a dependency

onSetup(() => {
  console.log(count.get()); // Runs once, use listen() for reactive updates
});
```

**Why this matters**: Dependency arrays cause errors. Retend's reactivity system is automatic.

---

## [CRITICAL] Components Render ONCE

**Applies to**: Component function bodies

**Rule**: Component functions run exactly ONE TIME. State updates do NOT re-run the component.

**Correct Pattern**:
```tsx
function Counter() {
  console.log('This runs ONCE'); // Only logs on initial render
  
  const count = Cell.source(0);
  
  const handleClick = () => {
    count.set(count.get() + 1); // Updates the Cell value
    // Component function does NOT re-run
  };
  
  return (
    <div>
      {count} {/* This updates automatically via Cell subscription */}
      <button type="button" onClick={handleClick}>Increment</button>
    </div>
  );
}
```

**Why this matters**: React components re-run on state changes. Retend components run once. Cells handle updates.

---

## [CRITICAL] NEVER Use Ternary or Logical Operators in JSX

**Applies to**: All conditional rendering in JSX

**Rule**: Use `If()` component. Never use `? :` or `&&` in JSX.

**Correct Pattern**:
```tsx
const isVisible = Cell.source(true);

// WRONG - React pattern
return (
  <div>
    {isVisible.get() ? <Modal /> : null} {/* Also breaks: .get() in JSX */}
    {isVisible && <Modal />} {/* Logical operator */}
  </div>
);

// CORRECT - Retend pattern
return (
  <div>
    {If(isVisible, { true: () => <Modal /> })}
  </div>
);
```

**Why this matters**: Ternary/logical operators break reactivity patterns. `If()` handles Cells properly.

---

## [CRITICAL] NEVER Use .map() for Lists

**Applies to**: Rendering arrays from Cells

**Rule**: Use `For()` helper. Never use `.map()` on Cell values.

**Correct Pattern**:
```tsx
const items = Cell.source(['a', 'b', 'c']);

// WRONG - React pattern, full re-render on any change
return (
  <ul>
    {items.get().map((item) => <li>{item}</li>)}
  </ul>
);

// CORRECT - Retend pattern, granular updates
return (
  <ul>
    {For(items, (item) => <li>{item}</li>)}
  </ul>
);
```

**Why this matters**: `.map()` re-renders entire list. `For()` only updates changed items.

---

## [WARNING] Define Derived Values Outside JSX

**Applies to**: `Cell.derived()` and `Cell.derivedAsync()` usage

**Rule**: Define derived cells in component body, not inline in JSX.

**Correct Pattern**:
```tsx
function Display() {
  const count = Cell.source(0);
  
  // CORRECT - defined in body
  const doubled = Cell.derived(() => count.get() * 2);
  const userData = Cell.derivedAsync(async (get) => {
    return await fetchUser(get(userId));
  });
  
  return (
    <div>
      {doubled}
      {userData}
    </div>
  );
}
```

**Why this matters**: Cleaner code, separates logic from presentation.

---

## [CRITICAL] Use `get` Parameter in derivedAsync

**Applies to**: `Cell.derivedAsync()` dependencies

**Rule**: Always use the `get` parameter function to read dependencies. Never call `.get()` directly inside `derivedAsync`.

**Correct Pattern**:
```tsx
const userId = Cell.source(1);

// WRONG - no dependency tracking
const user = Cell.derivedAsync(async () => {
  const id = userId.get(); // NOT tracked!
  return await fetchUser(id);
});

// CORRECT - tracked dependencies
const user = Cell.derivedAsync(async (get) => {
  const id = get(userId); // Tracked dependency
  return await fetchUser(id);
});
```

**Why this matters**: The `get` param enables reactive dependency tracking. Direct `.get()` is not tracked.

---

## [WARNING] Hoist Event Handlers

**Applies to**: Event handler definitions

**Rule**: Define handlers as named functions before JSX. Avoid inline arrow functions in JSX.

**Correct Pattern**:
```tsx
function Form() {
  const name = Cell.source('');
  
  // CORRECT - hoisted handler
  const handleChange = (event) => {
    name.set(event.target.value);
  };
  
  return (
    <input type="text" onInput={handleChange} />
  );
}
```

**Why this matters**: Cleaner code, separates logic from view.

---

## Quick Reference: React vs Retend

| React | Retend | Notes |
|-------|--------|-------|
| `useState(initial)` | `Cell.source(initial)` | Initialize once, use throughout |
| `useEffect(fn, [])` | `onSetup(fn)` | Runs once, no deps array |
| `useEffect(fn, [dep])` | `cell.listen(fn)` | Reactive updates |
| `useMemo(() => compute, [dep])` | `Cell.derived(() => compute)` | Auto-tracking, no deps |
| `useCallback(fn, [dep])` | Plain function `fn` | No memoization needed |
| `useRef(initial)` | `Cell.source(initial)` | Same pattern |
| `useContext(Context)` | `useScopeContext(Scope)` | Similar API |
| `createContext()` | `createScope()` | Similar API |
| `props.value` | `props.value` | Same for static |
| `condition ? A : B` | `If(condition, { true: () => A, false: () => B })` | Use If helper |
| `array.map(...)` | `For(array, ...)` | Use For helper |
| `key={id}` | `{ key: 'id' }` | 3rd param to For |
| `onChange={fn}` | `onInput={fn}` | Use onInput for text |
| `value={x}` + `onChange` | `Input` from retend-utils | Or manual binding |

---

## Decision Flow for State Management

```
NEED STATE?
├─ Simple value → Cell.source(initialValue)
├─ Computed from other state → Cell.derived(() => ...)
├─ Async data → Cell.derivedAsync(async (get) => ...)
└─ Global/shared state → createScope() + useScopeContext()
```

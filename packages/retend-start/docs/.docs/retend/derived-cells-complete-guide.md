---
description: Complete guide to Cell.derived() and Cell.derivedAsync(). Covers dependency tracking, error handling, and async patterns.
---

# Derived Cells Complete Guide

**Purpose**: Master computed values and async data with proper reactivity.

**CRITICAL PRINCIPLE**: Derived cells automatically track dependencies and recompute when they change. Async derived cells handle loading states and errors.

---

## [CRITICAL] Basic Derived Cells

**Applies to**: Computing values from other Cells

**Rule**: Use `Cell.derived()` for computed values that depend on other Cells.

**Explicit Pattern**:
```tsx
const count = Cell.source(0);
const multiplier = Cell.source(2);

// ✅ CORRECT - derived cell with dependencies
const doubled = Cell.derived(() => count.get() * 2);
// ^ Automatically tracks count as dependency

const multiplied = Cell.derived(() => {
  return count.get() * multiplier.get();
});
// ^ Tracks both count and multiplier
```

**How Dependency Tracking Works**:
1. When the derived callback runs, Retend records every `.get()` call
2. Those Cells become dependencies
3. When any dependency changes, the derived cell recomputes
4. Lazy evaluation - only computes when read

**Explicit Anti-Patterns**:
```tsx
const count = Cell.source(0);

// ❌ WRONG - no dependencies tracked
const badDerived = Cell.derived(() => {
  return count.peek() * 2; // .peek() doesn't track!
});

// ❌ WRONG - trying to set derived
doubled.set(100); // Error! Derived cells are read-only
```

---

## [CRITICAL] Define Derived Cells Outside JSX

**Applies to**: All derived cell definitions

**Rule**: Define `Cell.derived()` in the component body, never inline in JSX.

**Explicit Pattern**:
```tsx
function Display() {
  const count = Cell.source(0);
  
  // ✅ CORRECT - define in body
  const doubled = Cell.derived(() => count.get() * 2);
  const tripled = Cell.derived(() => count.get() * 3);
  
  return (
    <div>
      {doubled}
      {tripled}
    </div>
  );
}
```

**Explicit Anti-Pattern**:
```tsx
function Display() {
  const count = Cell.source(0);
  
  return (
    <div>
      {/* ❌ WRONG - inline definition */}
      {Cell.derived(() => count.get() * 2)}
    </div>
  );
}
```

**Why**: Separates logic from presentation, cleaner code.

---

## [CRITICAL] derivedAsync - The get Parameter

**Applies to**: `Cell.derivedAsync()` dependency tracking

**Rule**: Always use the `get` parameter function to read dependencies. Never use `.get()` directly inside `derivedAsync`.

**Explicit Pattern**:
```tsx
const userId = Cell.source(1);

// ✅ CORRECT - use get parameter
const userData = Cell.derivedAsync(async (get) => {
  const id = get(userId); // Tracked dependency
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});
```

**Explicit Anti-Pattern**:
```tsx
const userId = Cell.source(1);

// ❌ WRONG - direct .get() not tracked
const userData = Cell.derivedAsync(async () => {
  const id = userId.get(); // NOT tracked!
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});
```

**Why**: The `get` function establishes reactive dependencies in async contexts. Direct `.get()` is not tracked.

---

## [CRITICAL] derivedAsync - Handle Pending State

**Applies to**: All `Cell.derivedAsync()` usage

**Rule**: Always handle the pending/loading state. derivedAsync returns a cell with `.pending` property.

**Explicit Pattern**:
```tsx
const userId = Cell.source(1);
const userData = Cell.derivedAsync(async (get) => {
  const id = get(userId);
  return await fetchUser(id);
});

// ✅ CORRECT - handle all states
return (
  <div>
    {If(userData.pending, {
      true: () => <div>Loading...</div>,
      false: () => (
        <div>
          {If(userData.error, {
            true: () => <div>Error: {userData.error.message}</div>,
            false: () => <div>User: {userData.get()}</div>
          })}
        </div>
      )
    })}
  </div>
);
```

**Understanding derivedAsync Return**:
```tsx
const asyncCell = Cell.derivedAsync(async (get) => { ... });

// asyncCell has these properties:
asyncCell.get()        // Current value (undefined while pending)
asyncCell.pending      // Cell<boolean> - true while loading
asyncCell.error        // Cell<Error | null> - set if promise rejects
asyncCell.promise      // The actual promise
```

---

## [CRITICAL] derivedAsync - Handle Errors

**Applies to**: All `Cell.derivedAsync()` usage

**Rule**: Always handle errors from derivedAsync. Check the `.error` cell.

**Explicit Pattern**:
```tsx
const userData = Cell.derivedAsync(async (get) => {
  const id = get(userId);
  return await fetchUser(id);
});

// ✅ CORRECT - handle error state
return (
  <div>
    {If(userData.error, {
      true: () => (
        <div class="error">
          Failed to load: {userData.error.get().message}
        </div>
      ),
      false: () => <div>{userData}</div>
    })}
  </div>
);
```

---

## [WARNING] derivedAsync - Use AbortSignal

**Applies to**: `Cell.derivedAsync()` with fetch or cancellable operations

**Rule**: Pass the AbortSignal to fetch/cancellable operations for cleanup.

**Explicit Pattern**:
```tsx
const searchQuery = Cell.source('');

const searchResults = Cell.derivedAsync(async (get, signal) => {
  const query = get(searchQuery);
  if (!query) return [];
  
  // ✅ CORRECT - pass signal for cancellation
  const response = await fetch(`/api/search?q=${query}`, {
    signal // Cancels when dependencies change
  });
  
  return response.json();
});
```

**Why**: When dependencies change, the previous async operation is cancelled. Prevents race conditions.

---

## [CRITICAL] derivedAsync - Pure Functions Only

**Applies to**: `Cell.derivedAsync()` callbacks

**Rule**: Keep derivedAsync callbacks pure. No side effects. Only computation and async fetching.

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - side effects in derivedAsync
const userData = Cell.derivedAsync(async (get) => {
  console.log('Fetching...'); // Side effect!
  analytics.track('fetch_user'); // Side effect!
  
  const id = get(userId);
  return await fetchUser(id);
});
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - pure function
const userData = Cell.derivedAsync(async (get) => {
  const id = get(userId);
  return await fetchUser(id); // Only async computation
});

// Side effects go in component-scoped listener (called directly, not in onSetup)
userData.listen(() => {
  console.log('User data updated');
  analytics.track('user_loaded');
});
```

---

## [WARNING] Chain derivedAsync Cells

**Applies to**: Async data that depends on other async data

**Rule**: Derive from derivedAsync cells using `derivedAsync`, not `derived`.

**Explicit Pattern**:
```tsx
const userId = Cell.source(1);

// First async cell
const user = Cell.derivedAsync(async (get) => {
  return await fetchUser(get(userId));
});

// ✅ CORRECT - chain with derivedAsync
const userPosts = Cell.derivedAsync(async (get) => {
  const u = await get(user); // Wait for user, tracks dependency
  return await fetchUserPosts(u.id);
});
```

**Why**: Use `get()` to await another async cell. It tracks the dependency and handles the promise resolution.

---

## [WARNING] Pure Derived Functions

**Applies to**: `Cell.derived()` callbacks

**Rule**: Keep derived callbacks pure. No side effects. Only computation.

**Explicit Pattern**:
```tsx
const count = Cell.source(0);

// ✅ CORRECT - pure computation
const doubled = Cell.derived(() => count.get() * 2);

// Side effects in component-scoped listener (called directly in component body)
count.listen((value) => {
  console.log('Count changed:', value);
});
```

---

## [WARNING] Don't Optimize for "Re-renders"

**Applies to**: Performance optimization mindset

**Rule**: Components don't "re-render" in Retend. Don't apply React optimization patterns.

**Explicit Understanding**:
```tsx
function Counter() {
  const count = Cell.source(0);
  
  console.log('This runs ONCE');
  
  return (
    <div>
      {count} {/* This updates without re-running Counter() */}
    </div>
  );
}
```

**React patterns that DON'T apply**:
- ❌ `useMemo` - Not needed, use `Cell.derived()`
- ❌ `useCallback` - Not needed, functions don't need memoization
- ❌ `React.memo` - Not needed, components don't re-render
- ❌ `shouldComponentUpdate` - Not applicable

---

## Quick Decision Flow

```
NEED A COMPUTED VALUE?
├─ Sync computation → Cell.derived(() => { ... })
└─ Async computation → Cell.derivedAsync(async (get) => { ... })

INSIDE Cell.derived()?
├─ Read dependencies → cell.get()
└─ Read without tracking → cell.peek()

INSIDE Cell.derivedAsync()?
├─ Read dependencies → get(cell)
└─ Cancel fetch → pass signal param

USING ASYNC CELL IN JSX?
├─ Check pending → asyncCell.pending
├─ Check error → asyncCell.error
└─ Get value → asyncCell (pass directly)
```

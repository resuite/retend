| title                          | impact   | impactDescription                                           | tags                                         |
| :----------------------------- | :------- | :---------------------------------------------------------- | :------------------------------------------- |
| derivedAsync From derivedAsync | CRITICAL | Prevents race conditions and ensures proper async chaining. | cells, derivedAsync, reactivity, correctness |

# Derive Async Cells from Async Cells

**Rule**: When a cell depends on `AsyncDerivedCell`, it must also use `Cell.derivedAsync()`.

**Why**: `Cell.derived()` expects sync values. Async cells return Promises.

**Invalid**:

```tsx
const user = Cell.derivedAsync(async () => {
  return await fetchUser();
});
const userName = Cell.derived(() => user.get()?.name); // Returns Promise, not data!
```

**Valid**:

```tsx
const user = Cell.derivedAsync(async () => {
  return await fetchUser();
});
const userName = Cell.derivedAsync(async (get) => {
  return (await get(user))?.name;
});
```

| title | impact | impactDescription | tags |
| :------------------ | :------- | :------------------------------------------------ | :-------------------------------------- |
| Use `get` Parameter | CRITICAL | Ensures reactive dependencies are tracked in async computations. | cells, derivedAsync, reactivity, correctness |

# Use `get` Parameter in derivedAsync

**Rule**: Always use the `get` parameter to read cell dependencies inside `Cell.derivedAsync()`. Never call `.get()` directly.

**Why**: The `get` parameter establishes reactive dependencies. Direct `.get()` calls are not tracked.

**Invalid**:
```tsx
const userData = Cell.derivedAsync(async () => {
  const id = userId.get(); // No tracking!
  return await fetchUser(id);
});
```

**Valid**:
```tsx
const userData = Cell.derivedAsync(async (get) => {
  const id = get(userId); // Tracked dependency
  return await fetchUser(id);
});
```

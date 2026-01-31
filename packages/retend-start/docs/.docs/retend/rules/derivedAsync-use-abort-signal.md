| title | impact | impactDescription | tags |
| :------------------ | :------- | :-------------------------------------------------- | :----------------------------------------- |
| Use AbortSignal | MEDIUM | Prevents race conditions and cancels stale requests. | cells, derivedAsync, performance, correctness |

# Use AbortSignal in derivedAsync

**Rule**: Pass the `signal` parameter to `fetch()` to prevent race conditions.

**Why**: Without cancellation, old requests can overwrite newer responses.

**Invalid**:
```tsx
const user = Cell.derivedAsync(async (get) => {
  const id = get(userId);
  const response = await fetch(`/api/users/${id}`); // Race condition!
  return response.json();
});
```

**Valid**:
```tsx
const user = Cell.derivedAsync(async (get, signal) => {
  const id = get(userId);
  const response = await fetch(`/api/users/${id}`, { signal });
  return response.json();
});
```

| title | impact | impactDescription | tags |
| :------------------ | :------- | :-------------------------------------------------- | :----------------------------------------- |
| Use AbortSignal | MEDIUM | Prevents race conditions and cancels stale requests. | cells, task, performance, correctness |

# Use AbortSignal in Cell.task()

**Rule**: Pass the `signal` parameter to `fetch()` and other cancellable operations.

**Why**: Without cancellation, stale requests can complete after newer ones, causing inconsistent state.

**Invalid**:
```tsx
const submitTask = Cell.task(async (formData) => {
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: formData
  }); // No cancellation!
  return response.json();
});
```

**Valid**:
```tsx
const submitTask = Cell.task(async (formData, signal) => {
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: formData,
    signal
  });
  return response.json();
});
```

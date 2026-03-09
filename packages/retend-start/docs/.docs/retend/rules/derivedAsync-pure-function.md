| title              | impact   | impactDescription                                      | tags                                     |
| :----------------- | :------- | :----------------------------------------------------- | :--------------------------------------- |
| Pure Async Derived | CRITICAL | Prevents side-effect loops and unpredictable behavior. | cells, derivedAsync, correctness, purity |

# Keep derivedAsync Pure

**Rule**: The async callback must be pure. No side effects like logging, DOM mutations, or POST requests.

**Why**: Derived cells may run multiple times. Side effects belong in listeners.

**Invalid**:

```tsx
const data = Cell.derivedAsync(async (get) => {
  console.log('Fetching...'); // Side effect!
  await fetch('/api/log', { method: 'POST' }); // Side effect!
  return await fetchData(get(id));
});
```

**Valid**:

```tsx
const data = Cell.derivedAsync(async (get) => {
  return await fetchData(get(id)); // Pure computation only
});

// Side effects in listener
data.listen((value) => {
  console.log('Data loaded:', value);
});
```

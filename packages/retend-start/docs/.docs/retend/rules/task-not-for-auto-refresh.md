| title                | impact | impactDescription                                         | tags                            |
| :------------------- | :----- | :-------------------------------------------------------- | :------------------------------ |
| Task vs derivedAsync | HIGH   | Prevents data from not updating when dependencies change. | cells, task, derivedAsync, data |

# Don't use Cell.task() for auto-refreshing data

**Rule**: Use `Cell.derivedAsync()` for data that should automatically re-fetch when dependencies change. `Cell.task()` is only for manually-triggered operations.

**Why**: `Cell.task()` only executes when `runWith()` is explicitly called. It does not track reactive dependencies.

**Invalid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;

  // BAD: Task won't auto-refresh when userId changes
  const userData = Cell.task(async (id: number, signal) => {
    const response = await fetch(`/api/users/${id}`, { signal });
    return response.json();
  });

  // Must manually call runWith() on every userId change
  userId.listen((id) => userData.runWith(id));

  return <div>{/* ... */}</div>;
}
```

**Valid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;

  // GOOD: derivedAsync auto-refreshes when userId changes
  const userData = Cell.derivedAsync(async (get, signal) => {
    const id = get(userId);
    const response = await fetch(`/api/users/${id}`, { signal });
    return response.json();
  });

  return <div>{/* ... */}</div>;
}
```

**When to use Cell.task()**:

- Form submissions (POST, PUT, DELETE)
- User-triggered actions (button clicks)
- One-time operations that shouldn't auto-execute

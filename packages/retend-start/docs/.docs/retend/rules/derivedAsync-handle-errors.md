| title                      | impact | impactDescription                                          | tags                                     |
| :------------------------- | :----- | :--------------------------------------------------------- | :--------------------------------------- |
| Handle derivedAsync Errors | HIGH   | Prevents unhandled promise rejections and silent failures. | cells, derivedAsync, errors, reliability |

# Handle Errors in derivedAsync

**Rule**: Always handle errors from `derivedAsync` cells using the `.error` property.

**Why**: Unhandled errors leave UI in broken states. The `.error` cell provides error recovery.

**Invalid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  const user = Cell.derivedAsync(async (get) => {
    const id = get(userId);
    return await fetchUser(id);
  });
  return <div>{user}</div>; // Fails silently
}
```

**Valid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  const user = Cell.derivedAsync(async (get) => {
    const id = get(userId);
    return await fetchUser(id);
  });
  const userName = Cell.derivedAsync(async (get) => {
    return (await get(user))?.name ?? '';
  });
  const hasUser = Cell.derived(() => user.get() !== null);

  return (
    <div>
      {If(user.error, { true: (err) => <ErrorMessage error={err} /> })}
      {If(hasUser, () => (
        <h1>{userName}</h1>
      ))}
    </div>
  );
}
```

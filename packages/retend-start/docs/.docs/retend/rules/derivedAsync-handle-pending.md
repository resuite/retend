| title                | impact | impactDescription                                  | tags                             |
| :------------------- | :----- | :------------------------------------------------- | :------------------------------- |
| Handle Pending State | MEDIUM | Shows loading feedback and prevents blank screens. | cells, derivedAsync, ux, loading |

# Handle Pending State in derivedAsync

**Rule**: Always handle the `.pending` state to show loading indicators.

**Why**: Users need feedback while waiting for async data.

**Invalid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  const user = Cell.derivedAsync(async (get) => {
    return await fetchUser(get(userId));
  });
  return <h1>{user}</h1>; // Blank while loading
}
```

**Valid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  const user = Cell.derivedAsync(async (get) => {
    return await fetchUser(get(userId));
  });
  const userName = Cell.derivedAsync(async (get) => {
    return (await get(user))?.name ?? '';
  });
  const hasUser = Cell.derived(() => user.get() !== null);

  return (
    <div>
      {If(user.pending, { true: () => <Spinner /> })}
      {If(hasUser, () => (
        <h1>{userName}</h1>
      ))}
    </div>
  );
}
```

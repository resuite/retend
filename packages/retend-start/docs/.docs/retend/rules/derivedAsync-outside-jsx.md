| title                    | impact | impactDescription      | tags              |
| :----------------------- | :----- | :--------------------- | :---------------- |
| derivedAsync Outside JSX | LOW    | Keeps templates clean. | components, style |

# Define derivedAsync Outside JSX

**Rule**: Define `Cell.derivedAsync()` in the component body, not inline in JSX.

**Why**: Cleaner templates. Separates logic from presentation.

**Invalid**:

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  return (
    <div>
      {Cell.derivedAsync(async (get) => {
        return await fetchUser(get(userId));
      })}
    </div>
  );
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
  return (
    <div>
      <h1>{userName}</h1>
    </div>
  );
}
```

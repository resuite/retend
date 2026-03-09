| title                  | impact | impactDescription                                 | tags                     |
| :--------------------- | :----- | :------------------------------------------------ | :----------------------- |
| derivedAsync Read-Only | Medium | Prevents runtime errors from invalid set() calls. | cells, derivedAsync, api |

# derivedAsync Cells are Read-Only

**Rule**: Never call `.set()` on `Cell.derivedAsync()` cells.

**Why**: Derived cells compute values from dependencies. Update source cells instead.

**Invalid**:

```tsx
const user = Cell.derivedAsync(async (get) => {
  return await fetchUser(get(userId));
});
user.set({ name: 'Alice' }); // Runtime error!
```

**Valid**:

```tsx
const user = Cell.derivedAsync(async (get) => {
  return await fetchUser(get(userId));
});
userId.set(2); // Triggers re-fetch
```

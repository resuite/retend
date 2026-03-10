| title                | impact | impactDescription                                         | tags                           |
| :------------------- | :----- | :-------------------------------------------------------- | :----------------------------- |
| Always Key For Items | Medium | Efficient list updates and proper item identity tracking. | performance, control-flow, For |

# Always Key For Items

**Context**: Using the `For` control flow component.

**Rule**: Always provide an explicit `key` option when using `For` with objects. Use either a property name string or a key function.

**Why**:

- **Efficient Updates**: Explicit keys enable the For component to cache and reuse DOM nodes efficiently when items move, are added, or removed.
- **Identity Tracking**: Keys provide stable identity for items, preventing unnecessary re-renders and maintaining component state across updates.
- **Predictable Behavior**: Without explicit keys, For falls back to auto-generated keys which may not handle all edge cases properly.

**When Keys Are Optional**:

- Primitive values (strings, numbers) are used as keys automatically
- For small, static lists that never change order or content

## Examples

### Invalid

```tsx
// Missing key for objects - relies on auto-keying
const users = Cell.source([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);

function UserList() {
  return (
    <ul>
      {For(users, (user) => (
        <li>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Valid - Property Key

```tsx
// Using a property name as key
const users = Cell.source([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);

function UserList() {
  return (
    <ul>
      {For(
        users,
        (user) => (
          <li>{user.name}</li>
        ),
        { key: 'id' }
      )}
    </ul>
  );
}
```

### Valid - Function Key

```tsx
// Using a function to generate keys
const items = Cell.source([
  { category: 'a', index: 0, value: 'First' },
  { category: 'b', index: 1, value: 'Second' },
]);

function ItemList() {
  return (
    <ul>
      {For(
        items,
        (item) => (
          <li>{item.value}</li>
        ),
        { key: (item) => `${item.category}-${item.index}` }
      )}
    </ul>
  );
}
```

### Valid - Primitives (No Key Needed)

```tsx
// Primitive values don't need explicit keys
const names = Cell.source(['Alice', 'Bob', 'Charlie']);

function NameList() {
  return (
    <ul>
      {For(names, (name) => (
        <li>{name}</li>
      ))}
    </ul>
  );
}
```

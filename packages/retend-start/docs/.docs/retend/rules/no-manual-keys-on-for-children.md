| title                          | impact | impactDescription                                  | tags           |
| :----------------------------- | :----- | :------------------------------------------------- | :------------- |
| No Manual Keys on For Children | Medium | Prevents key conflicts with For's internal keying. | for, keys, jsx |

# No Manual Keys on For Children

**Context**: Rendering lists with the For component.

**Rule**: Do not manually add `key` props to elements rendered inside `For()`. For handles keys automatically.

**Why**:

- For manages its own keying system for efficiency
- Manual keys can conflict with For's internal keys
- The `key` option on For is the correct way to specify keys
- Adding key props to children is a React pattern that doesn't apply

## Examples

### Invalid

```tsx
// INVALID - adding key prop to child
For(users, (user) => (
  <UserCard key={user.id} user={user} /> // Don't do this!
));

// INVALID - key on any element in For
For(items, (item, index) => (
  <div key={index}>
    {' '}
    {/* Don't do this! */}
    <span>{item.name}</span>
  </div>
));
```

### Valid

```tsx
// VALID - let For handle keys automatically
For(users, (user) => <UserCard user={user} />);

// VALID - use key option for explicit keying
For(users, (user) => <UserCard user={user} />, { key: 'id' }); // Use 'id' property as key

// VALID - with function key
For(users, (user) => <UserCard user={user} />, {
  key: (user) => `${user.type}-${user.id}`,
});
```

## How For Handles Keys

```tsx
// Automatic keying by object identity (for objects)
For(items, (item) => <div>{item.name}</div>);
// Uses WeakMap for object identity

// Automatic keying by value (for primitives)
For([1, 2, 3], (num) => <div>{num}</div>);
// Uses the primitive value as key

// Explicit property keying
For(users, (user) => <div>{user.name}</div>, { key: 'id' });
// Uses user.id as the key

// Custom key function
For(items, (item) => <div>{item.name}</div>, {
  key: (item, index) => `${item.category}-${index}`,
});
```

## React vs Retend Keying

**React:**

```tsx
// Must add key prop manually
{
  items.map((item) => <div key={item.id}>{item.name}</div>);
}
```

**Retend:**

```tsx
// For handles keys
{
  For(items, (item) => <div>{item.name}</div>, { key: 'id' });
}
```

## When You DO Need Keys

The only time to think about keys is when using the `key` option on For:

```tsx
// Specify which property to use as key
For(users, renderUser, { key: 'id' });

// Or use a function for complex keys
For(items, renderItem, {
  key: (item) => `${item.type}-${item.id}`,
});
```

Never add `key` as a prop to JSX elements inside For.

| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Pass Cell to Children in For | High | Ensures reactive updates in keyed For loops.           | for, keyed, reactivity      |

# Pass Cell to Children in For

**Context**: Passing item data to child components in keyed For loops.

**Rule**: Pass `Cell<Item>` (not just `Item`) to child components in For render callbacks. Let children create their own reactive derived values from the Cell.

**Why**:

- Keyed For caches component instances by key
- When item data changes but key stays the same, the render callback isn't re-invoked
- The `item` parameter is a static snapshot that never updates
- Child components need reactive access to the underlying data

## The Problem

```tsx
// Keyed For with user data
const users = Cell.source([
  { id: 1, firstName: 'John', lastName: 'Doe' },
  { id: 2, firstName: 'Jane', lastName: 'Smith' }
]);

// When you update a user's data:
users.set([
  { id: 1, firstName: 'Johnny', lastName: 'Doe' }, // Changed firstName!
  { id: 2, firstName: 'Jane', lastName: 'Smith' }
]);

// With key='id', the UserCard for id:1 is REUSED
// But the 'user' parameter in the callback is the OLD snapshot
```

## Examples

### Invalid

```tsx
// INVALID - passes static user, child can't react to data changes
For(users, (user) => {
  return <UserCard user={user} />; // user is frozen snapshot
}, { key: 'id' })

// In UserCard - won't see updates
function UserCard(props: { user: User }) {
  // props.user never changes even when data updates
  const fullName = `${props.user.firstName} ${props.user.lastName}`;
  return <div>{fullName}</div>;
}
```

### Valid

```tsx
// VALID - passes reactive cell, child can derive reactive values
For(users, (user, index) => {
  const userCell = Cell.derived(() => users.get()[index.get()]);
  return <UserCard user={userCell} />; // Pass Cell<User>
}, { key: 'id' })

// Child component receives Cell and creates reactive derived values
function UserCard(props: { user: Cell<User> }) {
  const fullName = Cell.derived(() => {
    const u = props.user.get();
    return `${u.firstName} ${u.lastName}`;
  });
  
  return <div>{fullName}</div>; // Updates when data changes
}
```

## Alternative Pattern

Pass the entire list and index:

```tsx
For(users, (user, index) => {
  return <UserCard users={users} index={index} />;
}, { key: 'id' })

function UserCard(props: { users: Cell<User[]>, index: Cell<number> }) {
  const user = Cell.derived(() => props.users.get()[props.index.get()]);
  const fullName = Cell.derived(() => {
    const u = user.get();
    return `${u.firstName} ${u.lastName}`;
  });
  
  return <div>{fullName}</div>;
}
```

## When This Matters

This pattern is critical when:
- Using keyed For (`{ key: 'id' }`)
- Child components derive values from item data
- Item data can change independently of list structure
- You need fine-grained reactivity within list items

Not needed when:
- Rendering simple, static content
- List items never change (only added/removed)
- Using unkeyed For (though explicit keys are preferred)

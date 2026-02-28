# Control Flow

## Rules
- **Use Built-in Flow**: Always use `If()`, `For()`, and `Switch()` instead of inline ternaries, logical operators (`&&`, `||`), or `.map()` in JSX.
  - ✅ `<div>{If(isVisible, { true: () => <Modal /> })}</div>`
  - ❌ `<div>{isVisible && <Modal />}</div>`
  - ❌ `<div>{isVisible ? <Modal /> : null}</div>`
  - ✅ `<ul>{For(items, (item) => <li>{item}</li>)}</ul>`
  - ❌ `<ul>{items.map(item => <li>{item}</li>)}</ul>`
- **Key for Items in For**: Always provide a `key` option when using `For` with objects. Use property name string or key function.
  - ✅ `For(users, (user) => ..., { key: 'id' })`
  - ❌ `For(users, (user) => ...)`
- **No Manual Keys in For**: Do not manually add `key` props to elements rendered inside `For()`. The `key` option on `For()` is the correct way.
  - ✅ `For(items, (item) => <li>{item}</li>, { key: 'id' })`
  - ❌ `For(items, (item) => <li key={item.id}>{item}</li>)`
- **For Index is a Cell**: The `index` parameter in `For()` is a `Cell<number>`, not a plain number. Use `index.get()` or derived values outside JSX.
- **Pass Cell to Children in Keyed For**: Pass `Cell<Item>` (not just `Item`) to child components in `For` render callbacks when using keyed `For`. This ensures reactivity if item data changes without changing the key.
  - ✅ `For(users, (user, index) => { const userCell = Cell.derived(() => users.get()[index.get()]); return <UserCard user={userCell} />; }, { key: 'id' })`
  - ❌ `For(users, (user) => <UserCard user={user} />, { key: 'id' })` (snapshot is frozen)
- **Prefer Object Syntax for If/Switch**: Use `{ true: ..., false: ... }` for `If()` and object literals for `Switch()` cases.
- **Pure Render Callbacks**: Functions passed to `If`, `For`, or `Switch` must be pure and return JSX. No side effects.

## Patterns
- **Switch for 3+ cases**: Use `Switch()` instead of nested `If` statements.
- **Switch.OnProperty**: Switch on specific object properties reactively.
- **If Object Syntax**: Always use the `{ true: ..., false: ... }` object literal for `If()` when both branches are provided.

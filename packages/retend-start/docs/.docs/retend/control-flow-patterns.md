---
description: Control flow patterns for If, For, Switch, and Observer. Covers keyed lists, conditional rendering, and proper reactivity.
---

# Control Flow Patterns

**Purpose**: Properly render lists and conditional content with fine-grained reactivity.

**CRITICAL PRINCIPLE**: Use Retend's built-in control flow helpers (`If`, `For`, `Switch`, `Observer`) instead of React patterns like ternary operators or `.map()`.

---

## [CRITICAL] Always Use Built-in Control Flow Helpers

**Applies to**: All conditional rendering and list rendering

**Rule**: Use `If()` for conditionals and `For()` for lists. Never use ternary operators, logical operators, or `.map()`.

**Explicit Pattern**:
```tsx
const isVisible = Cell.source(true);
const items = Cell.source(['a', 'b', 'c']);

// ✅ CORRECT - Retend control flow
return (
  <div>
    {If(isVisible, { true: () => <Modal /> })}
    
    <ul>
      {For(items, (item) => <li>{item}</li>)}
    </ul>
  </div>
);
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - React patternseturn (
  <div>
    {isVisible.get() ? <Modal /> : null}  {/* Ternary */}
    {isVisible && <Modal />}               {/* Logical && */}
    
    <ul>
      {items.get().map((item) => <li>{item}</li>)}  {/* .map() */}
    </ul>
  </div>
);
```

**Why This Matters**:
- `If()` and `For()` provide granular updates (only changed parts update)
- Ternary/map cause full re-renders of the expression
- Framework is optimized for these helpers

---

## [CRITICAL] If Component - Basic Usage

**Applies to**: Conditional rendering

**Rule**: Use `If(condition, renderFn)` for simple true-only conditionals.

**Explicit Pattern**:
```tsx
const showModal = Cell.source(false);

// ✅ CORRECT - simple If
return (
  <div>
    <button onClick={() => showModal.set(true)}>Show</button>
    {If(showModal, { true: () => <Modal /> })}
  </div>
);
```

**Key Point**: Pass the Cell directly (not `.get()`). The If component subscribes to changes.

---

## [WARNING] If Component - Use Object Syntax for Both Branches

**Applies to**: If with both true and false branches

**Rule**: When `If()` has both branches, use object syntax `{ true: ..., false: ... }`.

**Explicit Pattern**:
```tsx
const isLoggedIn = Cell.source(false);

// ✅ CORRECT - object syntax for both branches
return (
  <div>
    {If(isLoggedIn, {
      true: () => <UserMenu />,
      false: () => <LoginButton />
    })}
  </div>
);
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - positional arguments (harder to read)
{If(isLoggedIn,
  () => <UserMenu />,      // true branch
  () => <LoginButton />    // false branch
)}
```

---

## [CRITICAL] For Component - Basic Usage

**Applies to**: Rendering lists from Cells

**Rule**: Use `For(items, (item) => ...)` to render lists with fine-grained updates.

**Explicit Pattern**:
```tsx
const items = Cell.source(['Apple', 'Banana', 'Cherry']);

// ✅ CORRECT - For with Cell array
return (
  <ul>
    {For(items, (item) => (
      <li>{item}</li>
    ))}
  </ul>
);
```

**Works With**:
- Cell arrays
- Static arrays
- Cell maps/sets (converted to arrays)

---

## [CRITICAL] For Component - Always Use Keys with Objects

**Applies to**: Rendering lists of objects with For

**Rule**: Always provide an explicit `key` option when using `For` with objects.

**Explicit Pattern**:
```tsx
const users = Cell.source([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);

// ✅ CORRECT - explicit key property
return (
  <ul>
    {For(users, (user) => (
      <li>{user.name}</li>
    ), { key: 'id' })}  {/* Third parameter */}
  </ul>
);
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - no key for objects
{For(users, (user) => (
  <li>{user.name}</li>
))}
```

**Why**: Keys enable efficient DOM updates (reuse, reordering) and stable identity.

---

## [CRITICAL] For with Dynamic Keys

**Applies to**: Complex key requirements

**Rule**: Use a function for dynamic/computed keys.

**Explicit Pattern**:
```tsx
const items = Cell.source([
  { category: 'a', index: 0, value: 'First' },
  { category: 'b', index: 1, value: 'Second' }
]);

// ✅ CORRECT - function for complex keys
{For(items, (item) => (
  <li>{item.value}</li>
), { key: (item) => `${item.category}-${item.index}` })}
```

---

## [WARNING] For Index is a Cell

**Applies to**: Using the index parameter in For

**Rule**: The `index` parameter in `For()` is a `Cell<number>`, not a plain number.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - index is a Cell
For(items, (item, index) => {
  const displayNumber = Cell.derived(() => index.get() + 1);
  const isFirst = Cell.derived(() => index.get() === 0);
  
  return (
    <li class={[{ 'first': isFirst }]}>
      #{displayNumber}: {item}
    </li>
  );
})
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - treating index as number
For(items, (item, index) => {
  if (index === 0) { ... }  // Always false!
  return <li>Item {index + 1}</li>;  // TypeError!
})
```

**Why**: The index is reactive - it updates when items are reordered.

---

## [CRITICAL] Pass Cell to Children in Keyed For

**Applies to**: Child components in keyed For loops

**Rule**: Pass `Cell<Item>` (not just `Item`) to child components when using keyed For.

**The Problem**:
```tsx
// When using { key: 'id' }, items are cached by key
// The 'user' parameter is a static snapshot
For(users, (user) => {
  return <UserCard user={user} />;  // user is frozen!
}, { key: 'id' })

// If user data changes but id stays the same:
// - UserCard is REUSED (not re-rendered)
// - But 'user' param still has old data!
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - pass reactive cell
For(users, (user, index) => {
  const userCell = Cell.derived(() => users.get()[index.get()]);
  return <UserCard user={userCell} />;
}, { key: 'id' })

// Child component receives Cell
function UserCard(props: { user: Cell<User> }) {
  const fullName = Cell.derived(() => {
    const u = props.user.get();
    return `${u.firstName} ${u.lastName}`;
  });
  
  return <div>{fullName}</div>;  // Updates when data changes
}
```

**When Needed**:
- Keyed For with changing item data
- Child components derive values from items
- Fine-grained updates within list items

**Not Needed**:
- Simple, static content
- Unkeyed For
- Items that never change (only added/removed)

---

## [WARNING] Switch for Multiple Cases

**Applies to**: Multiple mutually exclusive conditions

**Rule**: Use `Switch()` for 3+ conditions instead of nested If or ternaries.

**Explicit Pattern**:
```tsx
const view = Cell.source('home');

// ✅ CORRECT - Switch for multiple cases
return (
  <div>
    {Switch(view, {
      home: () => <Home />,
      about: () => <About />,
      contact: () => <Contact />,
      default: () => <NotFound />
    })}
  </div>
);
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - nested ternaries
{view.get() === 'home' 
  ? <Home />
  : view.get() === 'about'
    ? <About />
    : view.get() === 'contact'
      ? <Contact />
      : <NotFound />
}

// ❌ WRONG - multiple If statements (all evaluate!)
{If(view.get() === 'home', () => <Home />)}
{If(view.get() === 'about', () => <About />)}
```

---

## [WARNING] Switch.OnProperty

**Applies to**: Switching on object properties

**Rule**: Use `Switch.OnProperty()` to switch on specific object properties.

**Explicit Pattern**:
```tsx
const user = Cell.source({ role: 'admin', name: 'Alice' });

// ✅ CORRECT - switch on property
return (
  <div>
    {Switch.OnProperty(user, 'role', {
      admin: () => <AdminDashboard />,
      editor: () => <EditorPanel />,
      viewer: () => <ViewerInterface />,
      default: () => <GuestView />
    })}
  </div>
);
```

---

## [WARNING] Use useObserver for DOM Connection

**Applies to**: Detecting when elements connect/disconnect from DOM

**Rule**: Use `useObserver()` hook instead of useLayoutEffect patterns.

**Explicit Pattern**:
```tsx
import { useObserver } from 'retend';

function MeasuredComponent() {
  const elementRef = Cell.source(null);
  const observer = useObserver();
  
  // ✅ CORRECT - useObserver for DOM connection
  observer.onConnected(elementRef, (el) => {
    console.log('Element mounted:', el);
    // Initialize something (measure, attach external lib, etc.)
    
    return () => {
      console.log('Element unmounted:', el);
      // Cleanup
    };
  });
  
  return <div ref={elementRef}>Content</div>;
}
```

**Why**: `useObserver` fires when nodes are actually connected to the DOM, not just when refs are assigned.

---

## [STYLE] Don't Add Manual Keys to For Children

**Applies to**: Children inside For loops

**Rule**: Don't manually add `key` props to elements inside For. For handles keys internally.

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - manual key prop
For(items, (item, index) => (
  <li key={index.get()}>{item}</li>  {/* Don't do this */}
), { key: 'id' })
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - let For handle keys
For(items, (item) => (
  <li>{item}</li>
), { key: 'id' })
```

---

## [WARNING] No Logical Operators in JSX

**Applies to**: All JSX expressions

**Rule**: Never use `&&` or `||` operators in JSX. Use `If()` instead.

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - logical operators
return (
  <div>
    {isVisible && <Modal />}
    {hasError || <ErrorMessage />}
  </div>
);
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - If component
return (
  <div>
    {If(isVisible, { true: () => <Modal /> })}
    {If(hasError, { false: () => <ErrorMessage /> })}
  </div>
);
```

---

## Quick Decision Flow

```
CONDITIONAL RENDERING?
├─ 2 branches (true/false) → If(condition, { true: ..., false: ... })
├─ 3+ branches → Switch(value, { case1: ..., case2: ..., default: ... })
└─ Switch on object prop → Switch.OnProperty(obj, 'prop', { ... })

LIST RENDERING?
├─ From Cell array → For(cellArray, (item) => ...)
├─ Objects in list → For(items, ..., { key: 'id' })
├─ Child components with keyed For → Pass Cell<Item> to children
└─ Need index → index is Cell<number>, use index.get()

DOM CONNECTION DETECTION?
└→ const observer = useObserver(); observer.onConnected(ref, callback)
```

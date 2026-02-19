---
description: Common mistakes and anti-patterns to avoid when writing Retend code. Each anti-pattern includes the correct solution.
---

# Common Anti-Patterns

**Purpose**: Identify and avoid the most common mistakes when writing Retend code.

**CRITICAL PRINCIPLE**: These patterns come from React habits or misunderstandings of Retend's fine-grained reactivity. Avoid them completely.

---

## [CRITICAL] Anti-Pattern #1: .get() in JSX

**The Mistake**: Calling `.get()` on a Cell inside JSX expressions.

**Why It's Wrong**: `.get()` returns a static snapshot. The value never updates because there's no subscription to the Cell.

**Wrong**:
```tsx
function Counter() {
  const count = Cell.source(0);

  return (
    <div>
      <p>{count.get()}</p>  {/* Static! Never updates! */}
      <button onClick={() => count.set(count.get() + 1)}>+</button>
    </div>
  );
}
```

**Correct**:
```tsx
function Counter() {
  const count = Cell.source(0);

  return (
    <div>
      <p>{count}</p>  {/* Reactive! Subscribes to changes */}
      <button onClick={() => count.set(count.get() + 1)}>+</button>
    </div>
  );
}
```

**Detection**: Look for `.get()` inside curly braces in JSX.

---

## [CRITICAL] Anti-Pattern #2: React Hooks

**The Mistake**: Importing or using React hooks (useState, useEffect, useMemo, etc.).

**Why It's Wrong**: React hooks don't exist in Retend. They will cause runtime errors.

**Wrong**:
```tsx
import { useState, useEffect } from 'retend';  // These don't exist!

function Counter() {
  const [count, setCount] = useState(0);  // ERROR!

  useEffect(() => {  // ERROR!
    console.log(count);
  }, [count]);

  return <div>{count}</div>;
}
```

**Correct**:
```tsx
import { Cell } from 'retend';

function Counter() {
  const count = Cell.source(0);

  // ✅ CORRECT - call .listen() directly in component body
  count.listen((value) => {
    console.log('Count:', value);
  });
  // Automatic cleanup - no onSetup wrapper needed!

  return <div>{count}</div>;
}
```

**Detection**: Look for `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`.

---

## [CRITICAL] Anti-Pattern #3: Dependency Arrays

**The Mistake**: Adding dependency arrays to `Cell.derived()` or `onSetup()`.

**Why It's Wrong**: Retend tracks dependencies automatically. Dependency arrays cause errors or unexpected behavior.

**Wrong**:
```tsx
const doubled = Cell.derived(() => count.get() * 2, [count]);  // ERROR!

onSetup(() => {
  console.log(count.get());
}, [count]);  // ERROR - no second parameter!
```

**Correct**:
```tsx
const doubled = Cell.derived(() => count.get() * 2);  // Auto-tracking

// For one-time setup (non-reactive)
onSetup(() => {
  console.log('Component mounted');
});

// For reactive side effects - call .listen() directly
count.listen((v) => {
  console.log('Count changed:', v);
});
```

**Detection**: Look for arrays as second parameters to derived or onSetup.

---

## [CRITICAL] Anti-Pattern #4: Ternary Operators in JSX

**The Mistake**: Using `? :` ternary operators for conditional rendering.

**Why It's Wrong**: Ternary operators don't handle reactive Cells properly and bypass framework optimizations.

**Wrong**:
```tsx
const isVisible = Cell.source(true);

return (
  <div>
    {isVisible.get() ? <Modal /> : null}  {/* React pattern */}
    {isVisible ? <Modal /> : null}        {/* Also wrong - uses truthiness */}
  </div>
);
```

**Correct**:
```tsx
const isVisible = Cell.source(true);

return (
  <div>
    {If(isVisible, { true: () => <Modal /> })}
  </div>
);
```

**Detection**: Look for `?` and `:` inside JSX curly braces.

---

## [CRITICAL] Anti-Pattern #5: Logical Operators in JSX

**The Mistake**: Using `&&` or `||` operators in JSX.

**Why It's Wrong**: Logical operators don't handle reactive Cells properly.

**Wrong**:
```tsx
const hasError = Cell.source(false);
const isLoading = Cell.source(true);

return (
  <div>
    {hasError && <ErrorMessage />}        {/* Wrong */}
    {isLoading || <Content />}            {/* Wrong */}
  </div>
);
```

**Correct**:
```tsx
const hasError = Cell.source(false);
const isLoading = Cell.source(true);

return (
  <div>
    {If(hasError, { true: () => <ErrorMessage /> })}
    {If(isLoading, { false: () => <Content /> })}
  </div>
);
```

**Detection**: Look for `&&` or `||` inside JSX curly braces.

---

## [CRITICAL] Anti-Pattern #6: .map() for Lists

**The Mistake**: Using `.map()` to render lists from Cells.

**Why It's Wrong**: `.map()` re-renders the entire list when any item changes. `For()` provides granular updates.

**Wrong**:
```tsx
const items = Cell.source(['a', 'b', 'c']);

return (
  <ul>
    {items.get().map((item) => (  {/* Full re-render on any change */}
      <li>{item}</li>
    ))}
  </ul>
);
```

**Correct**:
```tsx
const items = Cell.source(['a', 'b', 'c']);

return (
  <ul>
    {For(items, (item) => (  {/* Granular updates */}
      <li>{item}</li>
    ))}
  </ul>
);
```

**Detection**: Look for `.map(` following `.get()` on arrays in JSX.

---

## [CRITICAL] Anti-Pattern #7: No Keys in For with Objects

**The Mistake**: Using `For` with object arrays without providing keys.

**Why It's Wrong**: Without keys, For can't efficiently track items for updates, reordering, or removal.

**Wrong**:
```tsx
const users = Cell.source([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);

return (
  <ul>
    {For(users, (user) => (  {/* Missing key! */}
      <li>{user.name}</li>
    ))}
  </ul>
);
```

**Correct**:
```tsx
const users = Cell.source([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);

return (
  <ul>
    {For(users, (user) => (
      <li>{user.name}</li>
    ), { key: 'id' })}  {/* Proper key */}
  </ul>
);
```

**Detection**: Look for `For` with object arrays lacking a third parameter.

---

## [CRITICAL] Anti-Pattern #8: derivedAsync Without get Parameter

**The Mistake**: Using `.get()` directly inside `Cell.derivedAsync()` instead of the `get` parameter.

**Why It's Wrong**: Direct `.get()` is not tracked as a dependency in async contexts.

**Wrong**:
```tsx
const userId = Cell.source(1);

const user = Cell.derivedAsync(async () => {
  const id = userId.get();  // NOT tracked!
  return await fetchUser(id);
});
```

**Correct**:
```tsx
const userId = Cell.source(1);

const user = Cell.derivedAsync(async (get) => {
  const id = get(userId);  // Tracked dependency
  return await fetchUser(id);
});
```

**Detection**: Look for `.get()` calls inside `derivedAsync` callbacks.

---

## [CRITICAL] Anti-Pattern #9: Setting Derived Cells

**The Mistake**: Trying to call `.set()` on a derived Cell.

**Why It's Wrong**: Derived cells are computed from other cells. They are read-only.

**Wrong**:
```tsx
const count = Cell.source(0);
const doubled = Cell.derived(() => count.get() * 2);

// Later...
doubled.set(100);  // ERROR! Cannot set derived cells
```

**Correct**:
```tsx
const count = Cell.source(0);
const doubled = Cell.derived(() => count.get() * 2);

// Update the source
count.set(50);  // doubled automatically becomes 100
```

**Detection**: Look for `.set()` called on variables created with `Cell.derived()`.

---

## [CRITICAL] Anti-Pattern #10: Window Location Navigation

**The Mistake**: Using `window.location` methods for internal navigation.

**Why It's Wrong**: Causes full page reloads, destroying application state.

**Wrong**:
```tsx
const goToHome = () => {
  window.location.href = '/home';
  window.history.pushState({}, '', '/home');
};

// In JSX:
<a href="/about">About</a>  {/* Causes reload */}
```

**Correct**:
```tsx
import { useRouter, Link } from 'retend/router';

const goToHome = () => {
  const router = useRouter();
  router.navigate('/home');  // Client-side
};

// In JSX:
<Link href="/about">About</Link>  {/* Client-side */}
```

**Detection**: Look for `window.location`, `history.pushState`, or `<a href="/internal">`.

---

## [WARNING] Anti-Pattern #11: Inline Event Handlers

**The Mistake**: Defining event handlers as inline arrow functions in JSX.

**Why It's Wrong**: Clutters JSX and makes code harder to read and maintain.

**Wrong**:
```tsx
return (
  <button
    type="button"
    onClick={() => {
      count.set(count.get() + 1);
      analytics.track('increment');
    }}
  >
    +1
  </button>
);
```

**Correct**:
```tsx
const handleIncrement = () => {
  count.set(count.get() + 1);
  analytics.track('increment');
};

return (
  <button type="button" onClick={handleIncrement}>
    +1
  </button>
);
```

**Detection**: Look for arrow functions (`=>`) in event handler props.

---

## [WARNING] Anti-Pattern #12: Monolithic State Cells

**The Mistake**: Bundling unrelated state into a single object Cell.

**Why It's Wrong**: Updating one field updates the whole object, triggering unnecessary reactions.

**Wrong**:
```tsx
const formState = Cell.source({
  firstName: '',
  lastName: '',
  email: '',
  age: 0,
  isSubscribed: false
});

// Updating one field updates everything
const updateFirstName = (value) => {
  formState.set({ ...formState.get(), firstName: value });
};
```

**Correct**:
```tsx
const firstName = Cell.source('');
const lastName = Cell.source('');
const email = Cell.source('');
const age = Cell.source(0);
const isSubscribed = Cell.source(false);

// Update only what changed
const updateFirstName = (value) => {
  firstName.set(value);  // Only firstName subscribers update
};
```

**Detection**: Look for objects in `Cell.source()` with unrelated fields.

---

## [WARNING] Anti-Pattern #13: Not Awaiting Query Mutations

**The Mistake**: Not awaiting route query parameter mutations.

**Why It's Wrong**: Query mutations are async. Code after them may run before navigation completes.

**Wrong**:
```tsx
const handleFilter = (value) => {
  query.set('filter', value);  // Returns Promise!
  fetchData();  // Uses old query params
};
```

**Correct**:
```tsx
const handleFilter = async (value) => {
  await query.set('filter', value);
  fetchData();  // Uses updated query params
};
```

**Detection**: Look for query mutations without `await`.

---

## [WARNING] Anti-Pattern #14: Forgetting Cell is a Cell in Keyed For

**The Mistake**: Passing static item snapshot to children in keyed For loops.

**Why It's Wrong**: In keyed For, the callback isn't re-invoked when data changes (items are cached). Children need reactive access.

**Wrong**:
```tsx
For(users, (user) => {
  return <UserCard user={user} />;  // user is frozen snapshot!
}, { key: 'id' })

function UserCard({ user }) {
  // user never updates even when users array changes
  return <div>{user.name}</div>;
}
```

**Correct**:
```tsx
For(users, (user, index) => {
  const userCell = Cell.derived(() => users.get()[index.get()]);
  return <UserCard user={userCell} />;  // Pass Cell
}, { key: 'id' })

function UserCard({ user }) {
  const name = Cell.derived(() => user.get().name);
  return <div>{name}</div>;  // Updates reactively
}
```

**Detection**: Look for keyed For passing item data directly to child components.

---

## [WARNING] Anti-Pattern #15: lowercase component names

**The Mistake**: Using lowercase for component function names.

**Why It's Wrong**: JSX treats lowercase as HTML elements. Component won't render correctly.

**Wrong**:
```tsx
function userProfile() {  // lowercase!
  return <div>User</div>;
}

// Usage:
<userProfile />  {/* Treated as <userprofile> HTML tag */}
```

**Correct**:
```tsx
function UserProfile() {  // PascalCase
  return <div>User</div>;
}

// Usage:
<UserProfile />  {/* Renders as component */}
```

**Detection**: Look for `function lowercaseName()` when defining components.

---

## [WARNING] Anti-Pattern #16: React Memoization Patterns

**The Mistake**: Trying to use `useMemo`, `useCallback`, or `React.memo` patterns.

**Why It's Wrong**: These React patterns don't apply. Components don't "re-render" in Retend.

**Wrong**:
```tsx
// Trying to optimize "re-renders"
const memoizedValue = useMemo(() => compute(value), [value]);
const memoizedCallback = useCallback(() => doThing(), []);

// Component "optimization"
const MemoComponent = React.memo(Component);
```

**Correct**:
```tsx
// Use derived cells instead
const computed = Cell.derived(() => compute(value.get()));

// Plain functions - no memoization needed
const handleClick = () => doThing();

// No memo needed - components don't re-render
function Component() { ... }
```

**Detection**: Look for `useMemo`, `useCallback`, `memo`, or optimization comments about re-renders.

---

## [WARNING] Anti-Pattern #17: Using htmlFor Instead of for

**The Mistake**: Using `htmlFor` attribute on labels.

**Why It's Wrong**: Retend uses standard HTML attribute names, not React's camelCase versions.

**Wrong**:
```tsx
<label htmlFor="inputId">Label</label>  {/* React syntax */}
```

**Correct**:
```tsx
<label for="inputId">Label</label>  {/* Standard HTML */}
```

**Detection**: Look for `htmlFor` in label elements.

---

## Decision Tree: React Habit Regression

```
Does the JSX contain React patterns?
├─ .get() inside JSX → remove and pass Cell
├─ Ternary/logical operators → use If()
├─ .map() in JSX → use For()
├─ React hooks/imports → use Cells/onSetup/listen
└─ window.location → use router.navigate()
```

## Quick Detection Checklist

When reviewing code, scan for:

- [ ] `.get()` in JSX - Should pass Cell directly
- [ ] React hooks - Should use Cells
- [ ] Dependency arrays - Should remove them
- [ ] `? :` in JSX - Should use `If()`
- [ ] `&&` or `||` in JSX - Should use `If()`
- [ ] `.map()` on arrays - Should use `For()`
- [ ] For without keys - Should add `{ key: 'prop' }`
- [ ] `derivedAsync` with `.get()` - Should use `get` param
- [ ] `.set()` on derived - Should update source
- [ ] `window.location` - Should use Router
- [ ] Inline arrow handlers - Should hoist them
- [ ] Object state Cells - Should be granular
- [ ] Query mutations without await - Should await
- [ ] lowercase component names - Should be PascalCase
- [ ] `htmlFor` - Should be `for`

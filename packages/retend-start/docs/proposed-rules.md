# Proposed Rules for Retend

Based on codebase analysis, here are suggested rules to help prevent React-isms and API confusion:

## High Priority Rules

### 1. no-react-hooks (NEW)
**Problem**: Developers might try to import React hooks that don't exist in Retend.

**Rule**: Do not use React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`, etc.). Retend uses Cells and `useSetupEffect` instead.

**Examples**:
```tsx
// INVALID
import { useState, useEffect } from 'retend'; // These don't exist!

// VALID
import { Cell, useSetupEffect } from 'retend';
```

---

### 2. no-get-in-jsx (NEW)
**Problem**: Most common mistake - calling `.get()` inside JSX breaks reactivity.

**Rule**: Never call `.get()` on a Cell inside JSX expressions. Pass the Cell directly.

**Why**: 
- JSX unwraps Cells automatically for fine-grained reactivity
- `.get()` returns a static snapshot that won't update

**Examples**:
```tsx
// INVALID - breaks reactivity
<div>{count.get()}</div>

// VALID - reactive updates
<div>{count}</div>
```

---

### 3. no-dependency-arrays (NEW)
**Problem**: Developers adding dependency arrays to functions that don't need them.

**Rule**: Do not provide dependency arrays to `Cell.derived()` or `useSetupEffect()`. Retend tracks dependencies automatically.

**Examples**:
```tsx
// INVALID
const doubled = Cell.derived(() => count.get() * 2, [count]);
useSetupEffect(() => { /* ... */ }, [count]);

// VALID
const doubled = Cell.derived(() => count.get() * 2);
useSetupEffect(() => { /* ... */ });
```

---

### 4. derived-cells-readonly (NEW)
**Problem**: Trying to call `.set()` on derived cells.

**Rule**: Never call `.set()` on a derived cell. They are read-only.

**Examples**:
```tsx
// INVALID
const doubled = Cell.derived(() => count.get() * 2);
doubled.set(10); // Error!

// VALID - update the source
const doubled = Cell.derived(() => count.get() * 2);
count.set(5); // doubled automatically updates
```

---

### 5. no-usememo-usecallback (NEW)
**Problem**: Trying to optimize "re-renders" like in React.

**Rule**: Do not use `useMemo` or `useCallback` patterns. Retend components don't re-render.

**Why**: 
- Components run once on mount
- Updates happen through fine-grained cell reactivity
- No Virtual DOM means no need for memoization

**Examples**:
```tsx
// INVALID - doesn't exist in Retend
const memoized = useMemo(() => compute(a, b), [a, b]);
const callback = useCallback(() => doSomething(), []);

// VALID - just use cells and functions
const computed = Cell.derived(() => a.get() + b.get());
const callback = () => doSomething(); // Plain function
```

---

### 6. scope-provider-function-children (NEW)
**Problem**: Passing components directly to Scope providers without function wrapper.

**Rule**: Always pass children as a function to Scope providers, or use the `content` prop.

**Examples**:
```tsx
// INVALID
<MyScope.Provider value={data}>
  <Child />
</MyScope.Provider>

// VALID
<MyScope.Provider value={data}>
  {() => <Child />}
</MyScope.Provider>

// Also VALID
<MyScope.Provider value={data} content={Child} />
```

---

### 7. for-index-is-cell (NEW)
**Problem**: Treating For's index parameter as a number instead of a Cell.

**Rule**: Remember that the `index` parameter in `For()` is a Cell, not a number.

**Examples**:
```tsx
// INVALID - treating index as number
For(items, (item, index) => {
  console.log(index + 1); // index is a Cell!
  return <li>{index}</li>; // This works (cell in JSX)
})

// VALID
For(items, (item, index) => {
  const position = Cell.derived(() => index.get() + 1);
  return <li>Item #{position}</li>;
})
```

---

### 8. teleport-selector-limitations (NEW)
**Problem**: Trying to use complex CSS selectors with Teleport.

**Rule**: Teleport only supports `#id` or `tagname` selectors. No class names or attribute selectors.

**Examples**:
```tsx
// INVALID
<Teleport to=".modal-container">
<Teleport to="[data-portal]">

// VALID
<Teleport to="#modal-root">
<Teleport to="body">
```

---

### 9. lowercase-event-names (NEW)
**Problem**: Using lowercase event names like in standard HTML.

**Rule**: Use camelCase event names (same as React): `onClick`, `onMouseEnter`, not `onclick`.

**Examples**:
```tsx
// INVALID
<button onclick={handler}>
<button onmouseenter={handler}>

// VALID
<button onClick={handler}>
<button onMouseEnter={handler}>
```

---

### 10. no-re-render-optimization (NEW)
**Problem**: Thinking about preventing "re-renders" or component updates.

**Rule**: Do not attempt to optimize "re-renders". Retend components run once and don't re-render.

**Why**: 
- No Virtual DOM diffing
- Fine-grained reactivity through Cells
- Components are just functions that return elements once

---

### 11. query-mutations-are-async (NEW)
**Problem**: Expecting route query mutations to be synchronous.

**Rule**: Route query mutations (`set`, `append`, `delete`, `clear`) are async and trigger navigation.

**Examples**:
```tsx
// INVALID - treating as sync
const handleFilter = () => {
  query.set('filter', value); // Returns Promise!
  doSomething(); // Might run before navigation
}

// VALID
const handleFilter = async () => {
  await query.set('filter', value);
  doSomething(); // Runs after navigation
}
```

---

### 12. useobserver-not-layouteffect (NEW)
**Problem**: Using `useSetupEffect` to measure DOM nodes.

**Rule**: Use `useObserver()` for DOM connection awareness, not `useSetupEffect`.

**Examples**:
```tsx
// INVALID - node might not be in DOM yet
useSetupEffect(() => {
  const node = ref.get();
  if (node) measure(node);
});

// VALID
const observer = useObserver();
observer.onConnected(ref, (node) => {
  measure(node); // Guaranteed in DOM
  return () => cleanup(node);
});
```

---

### 13. no-react-imports (NEW)
**Problem**: Importing from React or ReactDOM when using Retend.

**Rule**: Do not import from 'react', 'react-dom', or 'react-dom/client'. Retend is a separate framework with its own APIs.

**Why**: 
- Retend has no Virtual DOM
- Retend uses Cells, not useState/useEffect
- Mixing React and Retend causes conflicts

**Examples**:
```tsx
// INVALID
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';

// VALID
import { Cell, useSetupEffect, render } from 'retend';
import { DomRenderer } from 'retend-web';
```

---

### 14. consistent-values-await (NEW)
**Problem**: Forgetting to await `useConsistent()`.

**Rule**: Always await `useConsistent()` calls. They return Promises.

**Examples**:
```tsx
// INVALID
const id = useConsistent('my-id', () => generateId());

// VALID
const id = await useConsistent('my-id', () => generateId());
```

---

### 15. prefer-switch-for-multiple-cases (NEW)
**Problem**: Using multiple If statements or complex conditionals for switch-like logic.

**Rule**: Use `Switch()` for multiple conditional branches instead of nested ternaries or multiple If statements.

**Examples**:
```tsx
// INVALID - messy nested conditionals
<div>
  {If(view === 'home', () => <Home />)}
  {If(view === 'about', () => <About />)}
  {If(view === 'contact', () => <Contact />)}
</div>

// VALID - clean Switch
<div>
  {Switch(view, {
    home: () => <Home />,
    about: () => <About />,
    contact: () => <Contact />,
    default: () => <NotFound />
  })}
</div>
```

---

### 16. for-pass-cell-to-children (NEW)
**Problem**: In keyed For loops, child components receive static item snapshots that don't update when data changes because component instances are cached by key.

**Rule**: Pass `Cell<Item>` (not just `Item`) to child components in For render callbacks. Let children create their own reactive derived values from the Cell.

**Why**:
- Keyed For caches component instances by key
- When item data changes but key stays the same, the render callback isn't re-invoked
- The `item` parameter is a static snapshot that never updates
- Child components need reactive access to the underlying data

**Examples**:
```tsx
// INVALID - passes static user, child can't react to data changes
For(users, (user) => {
  return <UserCard user={user} />; // user is frozen snapshot
}, { key: 'id' })

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
  return <div>{fullName}</div>;
}
```

---

## Medium Priority Rules

### 17. prefer-camelcase-events (Already exists in retend-web/rules/event-modifiers.md)
**Status**: Check if this is covered. If not, add it.

---

### 18. no-string-concat-in-class (Already exists in retend-web/rules/class-attribute-syntax.md)
**Status**: Already covered.

---

### 19. fragment-shorthand (NEW)
**Problem**: Importing Fragment like in React.

**Rule**: Use empty tag shorthand `<></>` for fragments. Do not import Fragment.

**Examples**:
```tsx
// INVALID
import { Fragment } from 'retend';
<Fragment><A /><B /></Fragment>

// VALID
<><A /><B /></>
```

---

### 20. no-manual-keys-on-for-children (NEW)
**Problem**: Adding `key` prop to children rendered by For (like in React).

**Rule**: Do not manually add `key` props to elements rendered inside `For()`. For handles keys automatically.

**Examples**:
```tsx
// INVALID
For(items, (item) => <li key={item.id}>{item.name}</li>)

// VALID
For(items, (item) => <li>{item.name}</li>)
// OR with explicit key option:
For(items, (item) => <li>{item.name}</li>, { key: 'id' })
```

---

### 21. derived-state-outside-jsx (Already exists)
**Status**: Already covered in derived-outside-jsx.md

---

## Discussion Points

1. **Should useSetupEffect be emphasized more?** - It's critical but easy to miss.

2. **Event modifiers**: The retend-web skill already has good coverage. Ensure we reference it.

3. **Style attribute**: Should we have a rule about reactive styles with Cells?

4. **Class attribute merging**: Already covered in retend-web, but worth mentioning in retend rules too?

5. **Switch coverage**: Should we add more Switch examples to existing rules like use-builtin-control-flow?

---

## Rules to Potentially Remove/Deduplicate

- Check if any proposed rules overlap with existing rules
- The `no-logical-operators-in-jsx.md` we just created covers some of this
- `use-builtin-control-flow.md` covers If/For vs ternary/map

---

## Priority Ranking

**Must Have (Critical React-isms)**:
1. no-get-in-jsx (most common mistake)
2. no-react-hooks
3. no-react-imports
4. no-dependency-arrays
5. no-usememo-usecallback
6. scope-provider-function-children

**Should Have (Common Confusion)**:
7. derived-cells-readonly
8. for-pass-cell-to-children (critical for keyed For loops)
9. useobserver-not-layouteffect
10. query-mutations-are-async
11. teleport-selector-limitations

**Nice to Have (Conventions)**:
12. lowercase-event-names
13. fragment-shorthand
14. no-manual-keys-on-for-children
15. prefer-switch-for-multiple-cases
16. consistent-values-await

---
description: Critical rules for using Cells in JSX. These are the most common mistakes that break reactivity.
---

# JSX Reactivity Patterns

**Purpose**: Ensure Cells work correctly in JSX for fine-grained reactivity.

**CRITICAL PRINCIPLE**: Cells must be passed directly to JSX. Calling `.get()` breaks reactivity.

---

## [CRITICAL] Pass Cells Directly to JSX - Never Use .get()

**Applies to**: All JSX expressions using Cell values

**Rule**: Pass the Cell object directly to JSX expressions and attributes. Never call `.get()` inside JSX.

**Explicit Pattern - ALWAYS DO THIS**:
```tsx
const count = Cell.source(0);
const name = Cell.source('Alice');

// ✅ CORRECT - Pass cells directly
return (
  <div>
    <p>{count}</p>                    {/* Cell in text */}
    <p>{name}</p>                     {/* Cell in text */}
    <input value={name} />            {/* Cell in attribute */}
    <div class={name} />              {/* Cell in class */}
    <div style={{ color: name }} />   {/* Cell in style */}
  </div>
);
```

**Explicit Anti-Pattern - NEVER DO THIS**:
```tsx
const count = Cell.source(0);
const name = Cell.source('Alice');

// ❌ WRONG - .get() breaks reactivity
return (
  <div>
    <p>{count.get()}</p>                    {/* Static value! */}
    <p>{name.get()}</p>                     {/* Never updates */}
    <input value={name.get()} />            {/* Frozen value */}
    <div class={name.get()} />              {/* No reactivity */}
    <div style={{ color: name.get() }} />   {/* Stays at initial value */}
  </div>
);
```

**Why This Breaks**: When you call `.get()`, you get the current value as a static snapshot. The JSX expression never updates because there's no subscription to the Cell.

**When to Use .get()** (Outside JSX):
```tsx
// ✅ CORRECT - Use .get() outside JSX
const count = Cell.source(0);

// In derived cells - tracks dependency
const doubled = Cell.derived(() => count.get() * 2);

// In callbacks
const handleClick = () => {
  console.log(count.get()); // Read current value
  count.set(count.get() + 1); // Read, modify, set
};

// In listen callbacks
count.listen((newValue) => {
  console.log('New value:', newValue); // Note: listen gives the value directly
});
```

---

## [CRITICAL] .get() Tracks Dependencies ONLY in Derived Cells

**Applies to**: `Cell.derived()` and `Cell.derivedAsync()` callbacks

**Rule**: Inside `Cell.derived()` or `Cell.derivedAsync()`, use `.get()` to establish reactive dependencies.

**Explicit Pattern**:
```tsx
const firstName = Cell.source('John');
const lastName = Cell.source('Doe');

// ✅ CORRECT - .get() tracks dependencies in derived
const fullName = Cell.derived(() => {
  return `${firstName.get()} ${lastName.get()}`;
});
// ^ Both firstName and lastName are now dependencies

// When either changes, fullName automatically updates
firstName.set('Jane'); // fullName now returns 'Jane Doe'
```

**How It Works**: Retend tracks which Cells you call `.get()` on during the derived computation. Those become the dependencies.

**Explicit Anti-Pattern**:
```tsx
const firstName = Cell.source('John');
const lastName = Cell.source('Doe');

// ❌ WRONG - using .peek() breaks dependency tracking
const fullName = Cell.derived(() => {
  return `${firstName.peek()} ${lastName.peek()}`;
});
// ^ No dependencies tracked - never updates!
```

---

## [WARNING] Use .peek() for Non-Reactive Reads

**Applies to**: Reading Cells without creating dependencies

**Rule**: Use `.peek()` when you need the current value but don't want to track it as a dependency.

**Explicit Pattern**:
```tsx
const count = Cell.source(0);
const multiplier = Cell.source(2);

// ✅ CORRECT - .peek() for conditional dependencies
const result = Cell.derived(() => {
  const m = multiplier.peek(); // Read but don't depend on multiplier
  if (m === 0) return 0;
  return count.get() * m; // Only count is a dependency
});

// Updates when count changes, ignores multiplier changes
```

**Use Cases for .peek()**:
- Conditional dependency tracking
- Side effects without subscription
- Performance optimization (avoid unnecessary updates)
- Reading in event handlers

---

## [CRITICAL] Cells Are Read-Only in JSX (No .set())

**Applies to**: All JSX expressions

**Rule**: Never call `.set()` on a Cell inside JSX. It won't work and causes confusion.

**Explicit Anti-Pattern**:
```tsx
const count = Cell.source(0);

// ❌ WRONG - .set() in JSX
return (
  <button onClick={() => count.set(count.get() + 1)}>
    Increment
  </button>
);
// ^ Inline arrow function with .set() - works but messy
```

**Explicit Pattern**:
```tsx
const count = Cell.source(0);

// ✅ CORRECT - hoisted handler with .set()
const handleIncrement = () => {
  count.set(count.get() + 1);
};

return (
  <button onClick={handleIncrement}>
    Increment
  </button>
);
```

---

## [WARNING] Derived Cells Are Read-Only

**Applies to**: `Cell.derived()` and `Cell.derivedAsync()` results

**Rule**: Never call `.set()` on a derived Cell. They are computed, not stored.

**Explicit Pattern**:
```tsx
const count = Cell.source(0);
const doubled = Cell.derived(() => count.get() * 2);

// ✅ CORRECT - update the source
const handleClick = () => {
  count.set(count.get() + 1); // doubled automatically updates
};

// ❌ WRONG - trying to set a derived cell
doubled.set(100); // Error! Cannot set derived cells
```

**Why**: Derived cells are computed from other cells. Update the source cells instead.

---

## [CRITICAL] Event Handlers: Use .get() to Read, .set() to Update

**Applies to**: All event handler callbacks

**Rule**: In event handlers, use `.get()` to read the current value and `.set()` to update it.

**Explicit Pattern**:
```tsx
const count = Cell.source(0);
const name = Cell.source('');

// ✅ CORRECT - handlers outside JSX
const handleIncrement = () => {
  count.set(count.get() + 1);
};

const handleNameChange = (event) => {
  name.set(event.target.value);
};

const handleReset = () => {
  count.set(0);
  name.set('');
};

return (
  <div>
    <p>Count: {count}</p>
    <button type="button" onClick={handleIncrement}>+1</button>
    <button type="button" onClick={handleReset}>Reset</button>
    
    <input 
      type="text" 
      value={name}
      onInput={handleNameChange}
    />
  </div>
);
```

**Note**: Use `onInput` for text inputs (fires on every keystroke), not `onChange`.

---

## [WARNING] Keep Cells Granular

**Applies to**: State design and Cell creation

**Rule**: Create separate Cells for independent values. Don't bundle unrelated state into one object Cell.

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - monolithic state
const formState = Cell.source({
  firstName: '',
  lastName: '',
  email: '',
  age: 0,
  isSubscribed: false
});

// Updating one field updates the whole object
const updateFirstName = (value) => {
  formState.set({ ...formState.get(), firstName: value });
};
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - granular cells
const firstName = Cell.source('');
const lastName = Cell.source('');
const email = Cell.source('');
const age = Cell.source(0);
const isSubscribed = Cell.source(false);

// Update only what changed
const updateFirstName = (value) => {
  firstName.set(value); // Only firstName subscribers update
};
```

**Why**: Granular Cells enable fine-grained updates. Changing one doesn't affect others.

---

## [STYLE] Component Structure Order

**Applies to**: All component definitions

**Rule**: Organize components in this order:
1. State Cells (`Cell.source()`)
2. Derived Cells (`Cell.derived()`, `Cell.derivedAsync()`)
3. Event handlers
4. Effects (`onSetup()`, `onConnected()`)
5. Return JSX

**Explicit Pattern**:
```tsx
function UserProfile(props: { userId: Cell<number> }) {
  // 1. State
  const { userId } = props;
  const localState = Cell.source('');

  // 2. Derived
  const user = Cell.derivedAsync(async (get) => {
    return await fetchUser(get(userId));
  });

  const displayName = Cell.derived(() => {
    const u = user.get();
    return u?.name ?? 'Anonymous';
  });

  // 3. Handlers
  const handleUpdate = () => {
    localState.set('updated');
  };

  // 4. Effects
  onSetup(() => {
    // Initialize something
    return () => {
      // Cleanup
    };
  });
  
  // 5. JSX
  return (
    <div>
      <h1>{displayName}</h1>
      <button type="button" onClick={handleUpdate}>Update</button>
    </div>
  );
}
```

---

## [CRITICAL] Reactive Props with ValueOrCell

**Applies to**: Component props that accept Cells or static values

**Rule**: Use `JSX.ValueOrCell<T>` type for props that can be either static or reactive.

**Explicit Pattern**:
```tsx
import type { JSX } from 'retend';

// Component accepts static or Cell
function Display(props: { value: JSX.ValueOrCell<string> }) {
  const { value } = props;
  
  // If value is a Cell, use it directly in JSX
  // If value is static, it also works (no reactivity)
  return <div>{value}</div>;
}

// Usage:
const dynamicValue = Cell.source('Hello');

// Both work:
<Display value="Static text" />     {/* Static */}
<Display value={dynamicValue} />    {/* Reactive */}
```

**Why**: Components should accept both for maximum flexibility.

---

## Decision Tree: Using Cells in JSX

```
Need a Cell value?
├─ Inside JSX → pass the Cell directly
├─ Inside Cell.derived() → use .get()
├─ Inside Cell.derivedAsync() → use get(cell)
├─ Inside handler/listener → use .get()
└─ Need no dependency → use .peek()
```

---

## Quick Decision Reference

| Situation | What to Use |
|-----------|-------------|
| Cell in JSX (text) | `{cellName}` - pass directly |
| Cell in JSX (attribute) | `attr={cellName}` - pass directly |
| Read Cell in `Cell.derived()` | `cellName.get()` - tracks dependency |
| Read Cell in `Cell.derivedAsync()` | `get(cellName)` - tracks dependency |
| Read Cell in event handler | `cellName.get()` - current value |
| Read Cell without tracking | `cellName.peek()` - no subscription |
| Update Cell value | `cellName.set(newValue)` |
| Listen to changes | `cellName.listen(callback)` |
| Conditional rendering | `If(condition, { true: () => ... })` |
| List rendering | `For(items, (item) => ...)` |

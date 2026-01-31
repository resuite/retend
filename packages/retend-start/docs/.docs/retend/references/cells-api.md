# Cells API Reference

Cells are the reactive primitives in Retend. They provide fine-grained reactivity without virtual DOM diffing.

## Cell Types

### Cell.source()

Creates a **mutable** reactive cell that can be read and updated.

```tsx
import { Cell } from 'retend';

const count = Cell.source(0);
const name = Cell.source('Alice');
const items = Cell.source([1, 2, 3]);
```

**Methods:**

- `.get()` - Read the current value and track dependency
- `.set(newValue)` - Update the value and trigger updates
- `.peek()` - Read without tracking dependency

### Cell.derived()

Creates a **read-only** cell that automatically recomputes when its dependencies change.

```tsx
const count = Cell.source(5);
const doubled = Cell.derived(() => count.get() * 2);

console.log(doubled.get()); // 10
count.set(10);
console.log(doubled.get()); // 20
```

**Key Points:**

- Automatically tracks dependencies (any `.get()` calls inside)
- Recomputes only when dependencies change
- Cannot be manually set (read-only)
- Lazily evaluated (only computes when read)

**Methods:**

- `.get()` - Read the current value
- `.peek()` - Read without tracking as a dependency

## Core Methods

### .get()

Reads the current value and **tracks it as a dependency** in the current reactive context.

```tsx
const name = Cell.source('Alice');
const greeting = Cell.derived(() => `Hello, ${name.get()}!`);
// name is now a dependency of greeting
```

### .set(value)

Updates the value of a source cell and triggers all dependent cells to recompute.

```tsx
const count = Cell.source(0);
count.set(5);
count.set(count.get() + 1); // Read current, then set
```

**Note:** Only available on `Cell.source()` cells, not derived cells.

### .peek()

Reads the current value **without** tracking it as a dependency.

```tsx
const a = Cell.source(1);
const b = Cell.source(2);
const sum = Cell.derived(() => {
  const aVal = a.get(); // Tracked as dependency
  const bVal = b.peek(); // NOT tracked
  return aVal + bVal;
});

// Changing 'a' triggers recomputation
a.set(10); // sum updates

// Changing 'b' does NOT trigger recomputation
b.set(20); // sum does NOT update
```

**Use cases:**

- Reading a cell in a side effect without creating a dependency
- Conditional dependencies
- Performance optimization

### .listen(callback)

Manually subscribe to value changes. Returns an unsubscribe function.

- **Inside components:** Automatically scoped to the component (auto-cleanup).
- **Outside components:** Must be manually unsubscribed.

```tsx
const count = Cell.source(0);

const unsubscribe = count.listen((value) => {
  console.log('Count changed to:', value);
});

// Later, to stop listening:
unsubscribe();
```

## Lifecycle & Memory Management

Retend handles memory management automatically for cells created within components.

### Automatic Disposal

Cells created or derived inside a component function are tied to that component's lifecycle. When the component is removed from the DOM (unmounted), these cells are automatically disconnected and cleaned up.

```tsx
function SearchResults() {
  // This cell is automatically cleaned up when SearchResults unmounts
  const results = Cell.derived(() => performSearch(query.get()));

  return <div>{results}</div>;
}
```

**Note:** If you create cells outside of components (e.g., in a global store), they will persist for the lifetime of the application unless manually disposed.

### Component-Scoped Listeners

You can call `.listen()` directly within a component. The subscription is automatically tied to the component's lifecycle and will be cleaned up when the component unmounts. Do not use `useSetupEffect` for this.

```tsx
import { Cell } from 'retend';

function ListenerExample() {
  const count = Cell.source(0);

  // Automatically cleaned up on unmount
  count.listen((value) => {
    console.log('Value changed:', value);
  });

  const increment = () => count.set(count.get() + 1);

  return <button onClick={increment}>Count: {count}</button>;
}
```

## Advanced Patterns

### Conditional Dependencies

Use `.peek()` to conditionally track dependencies:

```tsx
const mode = Cell.source('light');
const lightColor = Cell.source('#ffffff');
const darkColor = Cell.source('#000000');

const backgroundColor = Cell.derived(() => {
  if (mode.get() === 'light') {
    return lightColor.get(); // Only tracks lightColor when mode is 'light'
  } else {
    return darkColor.get(); // Only tracks darkColor when mode is 'dark'
  }
});
```

### Derived from Multiple Sources

```tsx
const firstName = Cell.source('John');
const lastName = Cell.source('Doe');
const fullName = Cell.derived(() => `${firstName.get()} ${lastName.get()}`);
```

### Batching Updates

Multiple `.set()` calls trigger updates independently. For better performance with related updates:

```tsx
const x = Cell.source(0);
const y = Cell.source(0);
const sum = Cell.derived(() => x.get() + y.get());

// This triggers sum to recompute twice
x.set(5);
y.set(10);

// Better: use a single source cell for related state
const position = Cell.source({ x: 0, y: 0 });
const sum2 = Cell.derived(() => {
  const pos = position.get();
  return pos.x + pos.y;
});

// This triggers sum2 to recompute once
position.set({ x: 5, y: 10 });
```

### Combining with Arrays

```tsx
const items = Cell.source([1, 2, 3]);
const doubled = Cell.derived(() => items.get().map((x) => x * 2));
const sum = Cell.derived(() => items.get().reduce((a, b) => a + b, 0));

// Update array
items.set([...items.get(), 4]); // Add item
items.set(items.get().filter((x) => x > 1)); // Filter
```

### Combining with Objects

```tsx
const user = Cell.source({
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
});

const displayName = Cell.derived(() => user.get().name);

// Update object properties
user.set({ ...user.get(), age: 31 }); // Update one field
user.set({ ...user.get(), email: 'newemail@example.com' }); // Update via function
```

## Common Patterns

### Toggle Boolean

```tsx
const isOpen = Cell.source(false);
const toggle = () => isOpen.set(!isOpen.get());
```

### Counter

```tsx
const count = Cell.source(0);
const increment = () => count.set(count.get() + 1);
const decrement = () => count.set(count.get() - 1);
const reset = () => count.set(0);
```

### Form State

```tsx
const formData = Cell.source({
  email: '',
  password: '',
  rememberMe: false,
});

  const current = formData.get();
  formData.set({ ...current, [field]: value });
};

const isValid = Cell.derived(() => {
  const data = formData.get();
  return data.email.includes('@') && data.password.length >= 8;
});
```

### Derived Filtering

```tsx
const items = Cell.source([
  { id: 1, name: 'Apple', category: 'fruit' },
  { id: 2, name: 'Carrot', category: 'vegetable' },
  { id: 3, name: 'Banana', category: 'fruit' },
]);

const filter = Cell.source('fruit');

const filtered = Cell.derived(() =>
  items
    .get()
    .filter((item) => filter.get() === 'all' || item.category === filter.get())
);
```

### Loading State

```tsx
const isLoading = Cell.source(false);
const data = Cell.source(null);
const error = Cell.source(null);

async function fetchData() {
  isLoading.set(true);
  error.set(null);
  try {
    const response = await fetch('/api/data');
    data.set(await response.json());
  } catch (e) {
    error.set(e.message);
  } finally {
    isLoading.set(false);
  }
}
```

### Cell.derivedAsync()

Creates an **async derived cell** that automatically recomputes when its dependencies change, with built-in support for loading states, error handling, and request cancellation.

```tsx
const userId = Cell.source(1);

const userData = Cell.derivedAsync(async (get, signal) => {
  const id = get(userId);
  const response = await fetch(`/api/users/${id}`, { signal });
  return response.json();
});
```

**Parameters:**

- `callback: (get, signal) => Promise<U>` - An async function that computes the derived value
  - `get: <T>(cell: Cell<T>) => T` - Function to read cell values while tracking them as dependencies
  - `signal: AbortSignal` - Signal that aborts when a new computation starts (use for cancellation)

**Returns:** `AsyncDerivedCell<U>` with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `.get()` | `() => Promise<T \| null>` | Returns a promise that resolves to the async value |
| `.peek()` | `() => Promise<T \| null>` | Same as get() but without registering dependencies |
| `.pending` | `SourceCell<boolean>` | `true` while the async computation is running |
| `.error` | `SourceCell<Error \| null>` | Holds any error thrown during computation |
| `.revalidate()` | `() => void` | Manually re-runs the async computation |

**Example with loading and error states:**

```tsx
function UserProfile(props: { userId: Cell<number> }) {
  const { userId } = props;
  const user = Cell.derivedAsync(async (get, signal) => {
    const id = get(userId);
    const response = await fetch(`/api/users/${id}`, { signal });
    return response.json();
  });

  const userName = Cell.derivedAsync(async (get) => {
    const userData = await get(user);
    return userData?.name ?? '';
  });

  const hasUser = Cell.derived(() => user.get() !== null);

  return (
    <div>
      {If(user.pending, {
        true: () => <LoadingSpinner />,
      })}
      {If(user.error, {
        true: (err) => <ErrorMessage error={err} />,
      })}
      {If(hasUser, () => <h1>{userName}</h1>)}
    </div>
  );
}
```

**Key features:**

- **Automatic dependency tracking** - Uses the `get` function to track which cells are dependencies
- **Automatic cancellation** - The `AbortSignal` is aborted when dependencies change, cancelling in-flight requests
- **Race condition prevention** - Old requests are cancelled when new ones start
- **Loading state** - The `.pending` cell indicates when computation is running
- **Error state** - The `.error` cell stores any errors that occur

**Listening for errors:**

```tsx
userData.error.listen((err) => {
  if (err) {
    console.error('Failed to load user:', err);
    showToast('Error loading user data');
  }
});
```

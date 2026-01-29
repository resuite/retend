| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Derived Cells Read-Only | Medium | Prevents runtime errors from invalid operations.       | cells, derived, api         |

# Derived Cells Read-Only

**Context**: Working with derived/computed values.

**Rule**: Never call `.set()` on a derived cell. They are read-only.

**Why**:

- Derived cells compute values from other cells
- They cannot be set directly - update the source cells instead
- Attempting to set a derived cell will throw an error

## Examples

### Invalid

```tsx
// INVALID - cannot set derived cells
const count = Cell.source(0);
const doubled = Cell.derived(() => count.get() * 2);

doubled.set(10); // Error! Cannot set derived cells
```

### Valid

```tsx
// VALID - update the source cell
const count = Cell.source(0);
const doubled = Cell.derived(() => count.get() * 2);

count.set(5); // doubled automatically updates to 10
```

## Pattern: Two-Way Derived Values

If you need computed values that can also be set, use a source cell with synchronization:

```tsx
function createWritableDerived(initial, compute, apply) {
  const source = Cell.source(initial);
  const derived = Cell.derived(() => compute(source.get()));
  
  return {
    get: () => derived.get(),
    set: (value) => source.set(apply(value)),
    listen: derived.listen.bind(derived),
  };
}

// Usage
const celsius = Cell.source(0);
const fahrenheit = createWritableDerived(
  32,
  (c) => (c * 9/5) + 32,
  (f) => (f - 32) * 5/9
);

// Both directions work
fahrenheit.set(212); // Updates celsius to 100
celsius.set(0);      // fahrenheit automatically becomes 32
```

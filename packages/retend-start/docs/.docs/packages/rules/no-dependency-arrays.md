| title                | impact | impactDescription                              | tags                       |
| :------------------- | :----- | :--------------------------------------------- | :------------------------- |
| No Dependency Arrays | High   | Prevents unnecessary complexity and confusion. | cells, effects, reactivity |

# No Dependency Arrays

**Context**: Creating derived cells and setup effects.

**Rule**: Do not provide dependency arrays to `Cell.derived()` or `onSetup()`. Retend tracks dependencies automatically.

**Why**:

- Retend uses automatic dependency tracking via Cells
- Dependency arrays are a React concept that doesn't apply
- Adding dependency arrays will cause errors or unexpected behavior

## Examples

### Invalid

```tsx
// INVALID - dependency arrays don't exist in Retend
const doubled = Cell.derived(() => count.get() * 2, [count]);

onSetup(() => {
  console.log(count.get());
}, [count]); // Error - no second parameter!
```

### Valid

```tsx
// VALID - automatic dependency tracking
const doubled = Cell.derived(() => count.get() * 2);
// ^ Automatically tracks that count is a dependency

onSetup(() => {
  console.log(count.get());
});
// ^ Runs once on mount

// For reactive updates, use cell.listen()
onSetup(() => {
  const unsubscribe = count.listen((newValue) => {
    console.log('Count changed:', newValue);
  });
  return unsubscribe;
});
```

## How Dependency Tracking Works

Retend automatically tracks which Cells are accessed:

```tsx
const firstName = Cell.source('John');
const lastName = Cell.source('Doe');

// Automatically tracks both firstName and lastName
const fullName = Cell.derived(() => {
  return `${firstName.get()} ${lastName.get()}`;
});

// When either firstName or lastName changes, fullName updates
```

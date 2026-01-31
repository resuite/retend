| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| For Index Is a Cell  | Medium | Prevents type errors and unexpected behavior.          | for, control-flow, cells    |

# For Index Is a Cell

**Context**: Working with the index parameter in For loops.

**Rule**: Remember that the `index` parameter in `For()` is a Cell containing the current index, not a number.

**Why**:

- For tracks item positions reactively
- The index updates when items are reordered
- Treating it as a number causes type errors and stale values

## Examples

### Invalid

```tsx
// INVALID - treating index as a number
For(items, (item, index) => {
  console.log(index + 1); // TypeError: index is a Cell!
  
  if (index === 0) { // Always false - comparing Cell to number
    return <li class="first">{item}</li>;
  }
  
  return <li>Item {index + 1}: {item}</li>; // Won't work
})
```

### Valid

```tsx
// VALID - treat index as a Cell
For(items, (item, index) => {
  // Use .get() outside JSX
  const position = Cell.derived(() => index.get() + 1);
  const isFirst = Cell.derived(() => index.get() === 0);
  
  return (
    <li class={If(isFirst, { true: () => 'first' })}>
      Item #{position}: {item}
    </li>
  );
})

// Or pass directly to JSX
For(items, (item, index) => {
  return <li>Position: {index}</li>; // JSX unwraps the Cell
})
```

## Reactive Index Benefits

```tsx
const items = Cell.source(['A', 'B', 'C']);

For(items, (item, index) => {
  const displayIndex = Cell.derived(() => index.get() + 1);
  
  // When items are reordered, index updates automatically
  return <li>{displayIndex}. {item}</li>;
});

// If items change to ['C', 'A', 'B']:
// C now shows index 1 (was 3)
// A now shows index 2 (was 1)
// B now shows index 3 (was 2)
```

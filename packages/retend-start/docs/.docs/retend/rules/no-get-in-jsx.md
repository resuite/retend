| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| No .get() in JSX     | Critical | Breaks reactivity and causes static renders.         | reactivity, jsx, cells      |

# No .get() in JSX

**Context**: Reading cell values inside JSX expressions.

**Rule**: Never call `.get()` on a Cell inside JSX expressions. Pass the Cell directly.

**Why**:

- JSX unwraps Cells automatically for fine-grained reactivity
- `.get()` returns a static snapshot that won't update when the cell changes
- This is the #1 mistake when migrating from React

## Examples

### Invalid

```tsx
// INVALID - breaks reactivity
function Counter() {
  const count = Cell.source(0);
  
  return <div>{count.get()}</div>; // Static value, won't update
}
```

### Valid

```tsx
// VALID - reactive updates
function Counter() {
  const count = Cell.source(0);
  
  return <div>{count}</div>; // Updates automatically when count changes
}
```

## When to Use .get()

- **Outside JSX**: Use `.get()` to read the current value
- **In callbacks**: Use `.get()` inside event handlers
- **In derived cells**: Use `.get()` to establish dependencies

```tsx
function Counter() {
  const count = Cell.source(0);
  
  // Outside JSX - use .get()
  const doubled = Cell.derived(() => count.get() * 2);
  
  // In callback - use .get()
  const handleClick = () => {
    console.log(count.get());
    count.set(count.get() + 1);
  };
  
  // In JSX - pass cell directly
  return (
    <div>
      {count}
      <button onClick={handleClick}>Increment</button>
    </div>
  );
}
```

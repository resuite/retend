| title               | impact | impactDescription                             | tags                            |
| :------------------ | :----- | :-------------------------------------------- | :------------------------------ |
| Component Structure | Low    | Consistent code organization and readability. | style, components, organization |

# Component Structure

**Rule**: Follow this exact order for component internals:

1. **Prop Destructuring**: `const { ... } = props;`
2. **Constants, Hooks, and Local Cells**: `const count = Cell.source(0);`
3. **Event Handlers and Inline Functions**: `const handleClick = ...`
4. **Effects**: `Cell.listen`, `onSetup`, and `useObserver` MUST come last, just before the return.
5. **JSX Return**: `return ( ... );`

**Why**:

- **Readability**: predictable, top-to-bottom flow.
- **Correctness**: Effects often depend on state and handlers being defined first. Placing them at the end ensures all dependencies are available.

## Examples

### Invalid

```tsx
function Counter(props) {
  onSetup(() => console.log('Init')); // Effects too early

  const { initial } = props; // Props too late
  const count = Cell.source(initial);

  return <div>{count}</div>;
}
```

### Valid

```tsx
function Counter(props) {
  // 1. Props
  const { initial } = props;

  // 2. State & Hooks
  const count = Cell.source(initial);

  // 3. Handlers
  const increment = () => count.set(count.get() + 1);

  // 4. Effects
  onSetup(() => {
    console.log('Counter initialized');
  });

  // 5. Return
  return <button onClick={increment}>{count}</button>;
}
```

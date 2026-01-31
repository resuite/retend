| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| No useMemo/useCallback | High | Removes unnecessary optimization attempts.             | react-migration, patterns   |

# No useMemo/useCallback

**Context**: Optimizing component performance.

**Rule**: Do not use `useMemo` or `useCallback` patterns. Retend components don't re-render.

**Why**:

- Components run once on mount and don't re-render
- Updates happen through fine-grained cell reactivity
- No Virtual DOM means no need for memoization
- These are React concepts that don't apply to Retend

## Examples

### Invalid

```tsx
// INVALID - doesn't exist in Retend
const memoizedValue = useMemo(() => expensiveCompute(a, b), [a, b]);
const memoizedCallback = useCallback(() => doSomething(a), [a]);

// INVALID - trying to prevent re-renders
const MemoizedComponent = memo(Component);
```

### Valid

```tsx
// VALID - just use cells
const computed = Cell.derived(() => expensiveCompute(a.get(), b.get()));
// ^ Automatically updates only when a or b changes

// VALID - plain functions
const handleClick = () => doSomething(a.get());
// ^ Just a function, no need to memoize

// VALID - components are already "memoized" by design
function MyComponent() {
  // Runs once, cells handle updates
  const count = Cell.source(0);
  return <div>{count}</div>;
}
```

## Mental Model Shift

**React**: Components re-render, optimize with memoization
**Retend**: Components run once, cells provide fine-grained updates

```tsx
// React - need useMemo to prevent re-computation
function ReactComponent({ items }) {
  const sorted = useMemo(() => [...items].sort(), [items]);
  return <div>{sorted.map(...)}</div>;
}

// Retend - Cell.derived is the right tool
function RetendComponent() {
  const items = Cell.source([3, 1, 2]);
  const sorted = Cell.derived(() => [...items.get()].sort());
  return <div>{For(sorted, item => <span>{item}</span>)}</div>;
}
```

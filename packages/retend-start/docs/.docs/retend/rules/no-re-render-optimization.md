| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| No Re-render Optimization | High | Prevents unnecessary complexity and confusion.         | react-migration, patterns   |

# No Re-render Optimization

**Context**: Thinking about component performance and updates.

**Rule**: Do not attempt to optimize "re-renders". Retend components run once and don't re-render.

**Why**:

- No Virtual DOM diffing
- Components execute once on mount
- Updates happen through fine-grained cell reactivity
- Traditional React optimization patterns don't apply

## What NOT to Do

```tsx
// DON'T - These patterns don't exist or don't help in Retend

// 1. No memoization needed
const MemoizedComponent = memo(Component);

// 2. No useCallback needed
const callback = useCallback(() => {}, []);

// 3. No useMemo needed
const computed = useMemo(() => expensiveCalc(data), [data]);

// 4. No shouldComponentUpdate
class MyComponent extends Component {
  shouldComponentUpdate() { return false; }
}

// 5. No PureComponent
class MyComponent extends PureComponent {}
```

## The Retend Way

```tsx
// Components run once - cells handle updates
function MyComponent() {
  const count = Cell.source(0);
  const doubled = Cell.derived(() => count.get() * 2);
  
  // No memoization, no callbacks, no PureComponent
  // Cells automatically provide fine-grained updates
  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => count.set(count.get() + 1)}>
        Increment
      </button>
    </div>
  );
}
```

## Mental Model

**React**: 
- Components re-render when state/props change
- Optimize with memo, useMemo, useCallback
- Virtual DOM diff determines what updates

**Retend**:
- Components run once on mount
- Cells provide fine-grained reactivity
- No Virtual DOM - direct DOM updates
- No re-renders to optimize

## When to Worry About Performance

Only optimize actual measured bottlenecks:

1. **Expensive derived calculations** - Use peek() or batch updates
2. **Large lists** - Use For with proper keying
3. **Heavy DOM operations** - Use useObserver to defer work

Don't prematurely optimize - Retend is already fast by design.

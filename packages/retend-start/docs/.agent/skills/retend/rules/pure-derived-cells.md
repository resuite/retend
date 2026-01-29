| title              | impact   | impactDescription                                             | tags                            |
| :----------------- | :------- | :------------------------------------------------------------ | :------------------------------ |
| Pure Derived Cells | CRITICAL | Ensures predictable data flow and prevents side-effect loops. | reactivity, correctness, purity |

# Pure Derived Cells

**Context**: Creating derived state with `Cell.derived()`.

**Rule**: The derivation function MUST be pure. It should not produce side effects (like API calls or DOM mutations).

**Why**:

- **Predictability**: Derived cells may run multiple times or in an unpredictable order.
- **Data Flow**: Side effects belong in Observers or Event Handlers.

```tsx
// Avoid
const bad = Cell.derived(() => {
  api.log(count.get()); // Side effect!
  return count.get() * 2;
});

// Good
// Inside a component:
// .listen is automatically scoped to the component's lifecycle
count.listen((val) => {
  api.log(val);
});

const good = Cell.derived(() => count.get() * 2);
```

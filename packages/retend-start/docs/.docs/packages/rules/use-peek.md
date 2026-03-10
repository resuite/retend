| title                              | impact | impactDescription                                   | tags                            |
| :--------------------------------- | :----- | :-------------------------------------------------- | :------------------------------ |
| Use .peek() for Non-Reactive Reads | HIGH   | Prevents infinite loops and unnecessary re-renders. | reactivity, performance, safety |

# Use .peek() for Non-Reactive Reads

**Context**: Reading a Cell's value inside an event handler or another reaction without establishing a dependency.

**Rule**: Use `.peek()` when you need the current value but don't want to re-run when it changes.

**Why**:

- **Cycles**: Prevents infinite loops when setting a Cell based on its own value inside a reaction.
- **Optimization**: Avoids unnecessary re-runs.

```tsx
const increment = () => {
  // We only want to WRITE, not subscribe
  count.set(count.peek() + 1);
};
```

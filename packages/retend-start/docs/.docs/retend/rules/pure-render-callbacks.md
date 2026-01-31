| title                 | impact   | impactDescription                                             | tags                            |
| :-------------------- | :------- | :------------------------------------------------------------ | :------------------------------ |
| Pure Render Callbacks | CRITICAL | Prevents infinite loops and unstable UI states during render. | control-flow, stability, purity |

# Pure Render Callbacks

**Context**: The functions passed to `If`, `For`, or `Switch`.

**Rule**: These callbacks must be pure and return JSX. Do not perform side effects inside them.

**Why**:

- **Stability**: These functions run during the render phase. Side effects here can cause infinite loops or inconsistent UI state.

```tsx
// Avoid
If(show, () => {
  analytics.track('shown'); // Side effect!
  return <Content />;
});
```

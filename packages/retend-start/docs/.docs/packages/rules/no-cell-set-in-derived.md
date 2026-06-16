| title                  | impact   | impactDescription                                     | tags                            |
| :--------------------- | :------- | :---------------------------------------------------- | :------------------------------ |
| No Cell Set In Derived | CRITICAL | Prevents side-effect loops inside derived reactivity. | reactivity, correctness, purity |

# No Cell Set In Derived

**Rule**: Do not call `.set()` inside `Cell.derived()`.

**Why**:

- **Purity**: Derived cells should only read dependencies and return a value.
- **Correctness**: Writing during derivation can create loops and ordering bugs.

## Invalid

```tsx
const status = Cell.derived(() => {
  loading.set(false);
  return data.get()?.status;
});
```

## Valid

```tsx
const status = Cell.derived(() => data.get()?.status);

loadTask.run().then(() => {
  loading.set(false);
});
```

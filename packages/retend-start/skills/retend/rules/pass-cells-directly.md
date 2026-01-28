| title               | impact   | impactDescription                                                       | tags                        |
| :------------------ | :------- | :---------------------------------------------------------------------- | :-------------------------- |
| Pass Cells Directly | CRITICAL | Maintains reactivity by allowing the framework to subscribe to updates. | components, reactivity, jsx |

# Pass Cells Directly

**Context**: Binding Cells to attributes or text.

**Rule**: Pass the Cell object directly to the attribute or expression. Do NOT call `.get()` inside JSX.

**Why**:

- **Reactivity**: Calling `.get()` unwraps the value immediately. Use the Cell itself so the framework can subscribe to updates.

```tsx
// Bad (loses reactivity updates)
<div>{count.get()}</div>
<input value={text.get()} />

// Good
<div>{count}</div>
<input value={text} />
```

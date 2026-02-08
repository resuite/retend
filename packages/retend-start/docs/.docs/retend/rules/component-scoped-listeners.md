| title                      | impact | impactDescription                                      | tags                           |
| :------------------------- | :----- | :----------------------------------------------------- | :----------------------------- |
| Component-Scoped Listeners | HIGH   | Simplifies side effects and ensures automatic cleanup. | reactivity, memory, components |

# Component-Scoped Listeners

**Context**: Listening to Cell updates inside a component using `.listen()`.

**Rule**: Call `.listen()` directly in the component body. Do NOT wrap it in `onSetup`.

**Why**:

- **Automatic Cleanup**: Retend automatically binds listeners created during component execution to the component's lifecycle.
- **Simplicity**: No need for manual cleanup or effect wrappers.

```tsx
function MyComponent() {
  const count = Cell.source(0);

  // CORRECT:
  count.listen((val) => console.log(val));

  // INCORRECT:
  // onSetup(() => count.listen(...));

  return <div>{count}</div>;
}
```

| title          | impact | impactDescription                                                             | tags                           |
| :------------- | :----- | :---------------------------------------------------------------------------- | :----------------------------- |
| Reactive Props | MEDIUM | Allows components to accept both static values and reactive Cells seamlessly. | composition, reactivity, props |

# Reactive Props

**Context**: Accepting props that might be static or reactive.

**Rule**: Use `JSX.ValueOrCell<T>` for such props and unwrap them with `useDerivedValue`.

**Why**:

- **Flexibility**: The component works with both simple values and Cells, making it easier to use.
- **Efficiency**: `useDerivedValue` handles the unification efficiently.

```tsx
interface ButtonProps {
  disabled?: JSX.ValueOrCell<boolean>;
}

export function Button(props: ButtonProps) {
  const isDisabled = useDerivedValue(props.disabled); // Returns a read-only Cell

  return <button disabled={isDisabled}>Click me</button>;
}
```

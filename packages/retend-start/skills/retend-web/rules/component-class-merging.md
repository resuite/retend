| title                   | impact | impactDescription                                   | tags                        |
| :---------------------- | :----- | :-------------------------------------------------- | :-------------------------- |
| Component Class Merging | MEDIUM | Allows safe and easy extension of component styles. | styling, composition, props |

# Component Class Merging

**Context**: Accepting a `class` prop on a reusable component.

**Rule**: Use array syntax to merge your internal classes with the user-provided `class` prop.

**Why**:

- **Composition**: Allows users to extend your component's styling non-destructively.
- **Reliability**: Handles strings, arrays, objects, and Cells correctly.

```tsx
export function Card(props: JSX.BaseContainerProps) {
  return <div class={['card-base', props.class]}>{props.children}</div>;
}
```

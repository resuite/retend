| title                          | impact | impactDescription                                                  | tags                               |
| :----------------------------- | :----- | :----------------------------------------------------------------- | :--------------------------------- |
| Function Children as Component | Medium | Ensures proper context handling and consistency with JSX patterns. | composition, children, correctness |

# Function Children as Component

**Rule**: When a `children` prop is a function (e.g. for render props or scope injection), alias it to a PascalCase variable (e.g., `Children`) and render it as a component `<Children />`.

**Why**:

- **Consistency**: Treats the function as a functional component, aligning with JSX idioms.
- **Context**: Helps ensure proper context propagation and lifecycle management if the function hooks into internal mechanics.

## Examples

### Invalid

```tsx
const Wrapper = (props) => {
  const { children } = props;
  return <div>{children()}</div>;
};
```

### Valid

```tsx
const Wrapper = (props) => {
  const { children: Children } = props;
  return (
    <div>
      <Children />
    </div>
  );
};
```

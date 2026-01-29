| title             | impact | impactDescription                         | tags          |
| :---------------- | :----- | :---------------------------------------- | :------------ |
| Self Closing Tags | Low    | Stylistic consistency and cleaner syntax. | syntax, style |

# Self Closing Tags

Elements without children (void elements or empty) MUST be self-closing (e.g., `<div />` not `<div></div>`).

## Reasoning

This keeps the code cleaner and consistent with JSX standards and Retend documentation.

## Examples

### Invalid

```tsx
const Component = () => {
  return <div></div>;
};
```

### Valid

```tsx
const Component = () => {
  return <div />;
};
```

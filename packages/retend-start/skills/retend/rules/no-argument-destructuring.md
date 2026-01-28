| title                     | impact | impactDescription                                          | tags                      |
| :------------------------ | :----- | :--------------------------------------------------------- | :------------------------ |
| Destructure Props in Body | Low    | Clean function signatures and predictable variable access. | syntax, components, style |

# Destructure Props in Body

**Context**: Component function signature and body.

**Rule**: Do NOT destructure props in the argument list. Instead, destructure them `const { ... } = props;` as the **first statement** in the function body.

**Why**:

- **Cleaner Signatures**: Keeps the function signature readable, especially with many props or TypeScript types.
- **Consistency**: Standardizes how props are accessed across the codebase.
- **Predictability**: Makes it clear where variables are coming from.

## Examples

### Invalid

```tsx
// Avoid destructuring in arguments
function Card({ title, children }) {
  return <div>{title}</div>;
}
```

### Valid

```tsx
// Prefer destructuring in the body
function Card(props) {
  const { title, children } = props;

  return <div>{title}</div>;
}
```

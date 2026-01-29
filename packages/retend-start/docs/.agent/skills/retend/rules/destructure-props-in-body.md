| title                     | impact | impactDescription                                          | tags                      |
| :------------------------ | :----- | :--------------------------------------------------------- | :------------------------ |
| Destructure Props in Body | Low    | Clean function signatures and predictable variable access. | syntax, components, style |

# Destructure Props in Body

**Context**: Component function signature and body.

**Rule**: Do NOT destructure props in the argument list. Instead, destructure them `const { ... } = props;` as the **first statement** in the function body. **Always destructure props - do NOT access props via `props.xxx` repeatedly throughout the component.**

**Why**:

- **Cleaner Signatures**: Keeps the function signature readable, especially with many props or TypeScript types.
- **Consistency**: Standardizes how props are accessed across the codebase.
- **Predictability**: Makes it clear where variables are coming from.
- **Readability**: Destructuring at the top makes all dependencies visible upfront. Using `props.xxx` everywhere creates visual noise and makes it harder to track what the component actually uses.

## Examples

### Invalid

```tsx
// Avoid destructuring in arguments
function Card({ title, children }) {
  return <div>{title}</div>;
}

// Also avoid NOT destructuring at all
function Card(props) {
  return (
    <div>
      <h1>{props.title}</h1>
      <div>{props.children}</div>
    </div>
  );
}
```

### Valid

```tsx
// Prefer destructuring in the body
function Card(props) {
  const { title, children } = props;

  return (
    <div>
      <h1>{title}</h1>
      <div>{children}</div>
    </div>
  );
}
```

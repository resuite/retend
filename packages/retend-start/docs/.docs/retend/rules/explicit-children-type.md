| title                  | impact | impactDescription                                              | tags                           |
| :--------------------- | :----- | :------------------------------------------------------------- | :----------------------------- |
| Explicit Children Type | HIGH   | Prevents type errors regarding identifying valid JSX children. | composition, typescript, props |

# Explicit Children Type

**Context**: Defining the `children` prop.

**Rule**: Always type the `children` prop explicitly using `JSX.Children`.

**Why**:

- **Correctness**: Ensures the component accepts valid JSX children (nodes, arrays, strings, etc.).

```tsx
interface Props {
  children?: JSX.Children;
}
```

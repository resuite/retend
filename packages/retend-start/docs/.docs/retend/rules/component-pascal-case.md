| title                 | impact | impactDescription                                   | tags           |
| :-------------------- | :----- | :-------------------------------------------------- | :------------- |
| Component Pascal Case | High   | Required for JSX to distinguish tags from elements. | syntax, naming |

# Component Pascal Case

**Rule**: Component names MUST be PascalCase (e.g., `MyComponent`, not `myComponent`).

**Why**:

- **JSX Spec**: JSX treats lowercase tags as built-in elements (like `div`, `span`) and capitalized tags as custom components. Lowecase component names will fail to render as components.

## Examples

### Invalid

```tsx
function myButton() {
  return <button />;
}

// Will likely be treated as a <mybutton> tag or error
<myButton />;
```

### Valid

```tsx
function MyButton() {
  return <button />;
}

<MyButton />;
```

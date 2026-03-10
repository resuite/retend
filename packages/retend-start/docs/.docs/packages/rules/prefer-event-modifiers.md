| title                  | impact | impactDescription                             | tags           |
| :--------------------- | :----- | :-------------------------------------------- | :------------- |
| Prefer Event Modifiers | Low    | Reduces boilerplate and improves readability. | syntax, events |

# Prefer Event Modifiers

Use event modifiers (e.g., `onClick--prevent`, `onClick--stop`) instead of calling `e.preventDefault()` or `e.stopPropagation()` manually.

## Reasoning

Retend provides built-in syntax for common event operations, making the code more declarative and concise.

## Examples

### Invalid

```tsx
const handleClick = (e) => {
  e.preventDefault();
  // ...
};

<a href="#" onClick={handleClick}>
  Click
</a>;
```

### Valid

```tsx
const handleClick = () => {
  // ...
};

<a href="#" onClick--prevent={handleClick}>
  Click
</a>;
```

| title       | impact | impactDescription                     | tags                         |
| :---------- | :----- | :------------------------------------ | :--------------------------- |
| Button Type | Medium | Prevents unintended form submissions. | syntax, forms, accessibility |

# Button Type

All `<button>` elements MUST have a `type` attribute (e.g., `type="button"` or `type="submit"`).

## Reasoning

The default type for a button in most browsers is `submit`. If a button is placed within a form, it will submit the form by default, potentially causing page reloads or unintended actions. Explicitly setting the type avoids this ambiguity.

## Examples

### Invalid

```tsx
<button>Click me</button>
```

### Valid

```tsx
<button type="button">Click me</button>
<button type="submit">Submit</button>
```

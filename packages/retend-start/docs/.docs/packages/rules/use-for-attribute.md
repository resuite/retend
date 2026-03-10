| title             | impact | impactDescription         | tags               |
| :---------------- | :----- | :------------------------ | :----------------- |
| Use For Attribute | Low    | HTML standard compliance. | syntax, attributes |

# Use For Attribute

Use the `for` attribute for labels, NOT `htmlFor`. Retend uses standard HTML attributes.

## Reasoning

Retend JSX aligns with standard HTML attributes rather than React's camelCased attributes for properties like `for` and `class`.

## Examples

### Invalid

```tsx
<label htmlFor="inputId">Name</label>
```

### Valid

```tsx
<label for="inputId">Name</label>
```

| title          | impact | impactDescription                               | tags                       |
| :------------- | :----- | :---------------------------------------------- | :------------------------- |
| SVG Namespaces | High   | Required for strict XML/SVG parsing compliance. | syntax, svg, compatibility |

# SVG Namespaces

**Rule**: All elements within an SVG (including the root `<svg>` and all its children like `<path>`, `<circle>`, etc.) MUST have the `xmlns` attribute set to `http://www.w3.org/2000/svg`.

**Why**:

- **Compliance**: Retend's JSX transform or runtime requires explicit namespaces for non-HTML elements to function correctly in strict environments.
- **Consistency**: Ensures all SVG content is explicitly defined as such.

## Examples

### Invalid

```tsx
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" />
</svg>
```

### Valid

```tsx
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle xmlns="http://www.w3.org/2000/svg" cx="50" cy="50" r="40" />
</svg>
```

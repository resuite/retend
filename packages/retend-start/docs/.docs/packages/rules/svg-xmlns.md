| title      | impact | impactDescription            | tags                       |
| :--------- | :----- | :--------------------------- | :------------------------- |
| SVG Markup | Info   | Guidance for inline SVG JSX. | syntax, svg, compatibility |

# SVG Markup

**Rule**: Write inline SVG as normal JSX. Preserve SVG attributes when they are part of the source markup.

**Why**:

Retend handles SVG elements in JSX without extra framework-specific attributes. Keep SVG markup close to the source asset so it remains easy to copy, edit, and compare.

## Examples

### Inline SVG

```tsx
<svg width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" />
</svg>
```

### SVG Asset Markup

```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="100"
  height="100"
  viewBox="0 0 100 100"
>
  <circle cx="50" cy="50" r="40" />
</svg>
```

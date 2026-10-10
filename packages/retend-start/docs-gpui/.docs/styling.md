# GPUI styling

Use `style={{ ... }}` rather than CSS files, class names, or browser selectors. GPUI supports typed layout, dimensions, spacing, font, colors, overflow, transform, and transition declarations. Numeric lengths are logical pixels. Prefer flex layout where needed.

```tsx
<button style={{ padding: 12, backgroundColor: '#333333', color: 'white', hover: { backgroundColor: '#555555' }, active: { scale: 0.97 } }}>
  Save
</button>
```

Pseudo-state objects are nested in `style`: `hover`, `focused`, `active`. `placeholder` on `input` and `textarea` can set the placeholder `color`. Individual declarations may be reactive Cells. These are native style snapshots, not CSS pseudo selectors.

API: https://retend.dev/docs/gpui-styling

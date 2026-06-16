| title                              | impact | impactDescription                                    | tags                 |
| :--------------------------------- | :----- | :--------------------------------------------------- | :------------------- |
| Prefer OnConnected For Ref DOM Use | HIGH   | Avoids reading DOM refs before the element connects. | lifecycle, refs, dom |

# Prefer OnConnected For Ref DOM Use

**Rule**: Use `onConnected(ref, callback)` when setup code needs a DOM ref value.

**Why**:

- **Timing**: `onSetup()` can run before a ref cell contains a connected element.
- **Clarity**: `onConnected()` provides the element directly and owns disconnect cleanup.

## Invalid

```tsx
const panelRef = Cell.source<HTMLDivElement | null>(null);

onSetup(() => {
  const panel = panelRef.get();
  panel?.focus();
});
```

## Valid

```tsx
const panelRef = Cell.source<HTMLDivElement | null>(null);

onConnected(panelRef, (panel) => {
  panel.focus();
});
```

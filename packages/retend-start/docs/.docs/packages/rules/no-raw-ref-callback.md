| title               | impact | impactDescription                               | tags                 |
| :------------------ | :----- | :---------------------------------------------- | :------------------- |
| No Raw Ref Callback | HIGH   | Keeps DOM refs observable through Retend cells. | refs, dom, lifecycle |

# No Raw Ref Callback

**Rule**: Do not pass callback functions to JSX `ref` attributes.

**Why**:

- **Reactivity**: Retend ref cells expose the element through the normal Cell API.
- **Lifecycle**: DOM work can be placed in `onConnected()` with cleanup.

## Invalid

```tsx
<div ref={(element) => setupPanel(element)} />
```

## Valid

```tsx
const panelRef = Cell.source<HTMLDivElement | null>(null);

onConnected(panelRef, setupPanel);

<div ref={panelRef} />;
```

| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| onConnected Not LayoutEffect | High | Ensures correct DOM timing and prevents bugs.          | lifecycle, dom, connection  |

# onConnected Not LayoutEffect

**Context**: Measuring or manipulating DOM nodes.

**Rule**: Use `onConnected()` for DOM connection awareness, not `onSetup`.

**Why**:

- `onSetup` runs immediately after component creation
- DOM nodes may not be in the document yet
- `onConnected` fires when nodes are actually connected to the DOM
- Provides proper cleanup callbacks when nodes disconnect

## Examples

### Invalid

```tsx
// INVALID - node might not be in DOM yet
function MeasureComponent() {
  const ref = Cell.source(null);

  onSetup(() => {
    const node = ref.get();
    if (node) {
      const rect = node.getBoundingClientRect(); // May be 0x0 if not in DOM
      console.log(rect);
    }
  });

  return <div ref={ref}>Measure me</div>;
}
```

### Valid

```tsx
// VALID - onConnected guarantees DOM connection
function MeasureComponent() {
  const ref = Cell.source(null);

  onConnected(ref, (node) => {
    // Guaranteed to be in the DOM
    const rect = node.getBoundingClientRect();
    console.log('Size:', rect.width, rect.height);

    // Return cleanup function
    return () => {
      console.log('Node disconnected');
    };
  });

  return <div ref={ref}>Measure me</div>;
}

// VALID - Reactive measurements
function ResponsiveComponent() {
  const ref = Cell.source(null);
  const windowSize = useWindowSize();

  onConnected(ref, (node) => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log('Resized:', entry.contentRect);
      }
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  });

  return <div ref={ref}>Resize me</div>;
}
```

## onConnected API

```tsx
// Watch when a ref connects to the DOM
onConnected(refCell, (node) => {
  // node is guaranteed to be in the DOM

  return () => {
    // Optional cleanup when node disconnects
  };
});
```

## Common Use Cases

1. **Measuring elements** - Get accurate dimensions
2. **Third-party libraries** - Initialize when DOM is ready
3. **Animations** - Start animations after element is visible
4. **Observers** - Set up ResizeObserver, IntersectionObserver, etc.

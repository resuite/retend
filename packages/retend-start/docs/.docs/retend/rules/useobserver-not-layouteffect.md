| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| useObserver Not LayoutEffect | High | Ensures correct DOM timing and prevents bugs.          | lifecycle, dom, observer    |

# useObserver Not LayoutEffect

**Context**: Measuring or manipulating DOM nodes.

**Rule**: Use `useObserver()` for DOM connection awareness, not `useSetupEffect`.

**Why**:

- `useSetupEffect` runs immediately after component creation
- DOM nodes may not be in the document yet
- `useObserver` fires when nodes are actually connected to the DOM
- Provides proper cleanup callbacks when nodes disconnect

## Examples

### Invalid

```tsx
// INVALID - node might not be in DOM yet
function MeasureComponent() {
  const ref = Cell.source(null);
  
  useSetupEffect(() => {
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
// VALID - useObserver guarantees DOM connection
function MeasureComponent() {
  const ref = Cell.source(null);
  const observer = useObserver();
  
  observer.onConnected(ref, (node) => {
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
  const observer = useObserver();
  const windowSize = useWindowSize();
  
  observer.onConnected(ref, (node) => {
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

## useObserver API

```tsx
const observer = useObserver();

// Watch when a ref connects to the DOM
observer.onConnected(refCell, (node) => {
  // node is guaranteed to be in the DOM
  
  return () => {
    // Optional cleanup when node disconnects
  };
});

// Watch when a ref disconnects from the DOM
observer.onDisconnected(refCell, (node) => {
  // Node was removed from DOM
});
```

## Common Use Cases

1. **Measuring elements** - Get accurate dimensions
2. **Third-party libraries** - Initialize when DOM is ready
3. **Animations** - Start animations after element is visible
4. **Observers** - Set up ResizeObserver, IntersectionObserver, etc.

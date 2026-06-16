| title                  | impact   | impactDescription                                 | tags                            |
| :--------------------- | :------- | :------------------------------------------------ | :------------------------------ |
| Require Effect Cleanup | CRITICAL | Prevents leaked listeners, observers, and timers. | lifecycle, cleanup, reliability |

# Require Effect Cleanup

**Rule**: `onSetup()` and `onConnected()` callbacks that create external resources must return cleanup.

**Why**:

- **Lifecycle safety**: Retend can remove the resource when the component is destroyed or disconnected.
- **Reliability**: Timers, listeners, observers, and subscriptions otherwise keep running after the UI is gone.

## Invalid

```tsx
onSetup(() => {
  window.addEventListener('resize', handleResize);
});
```

## Valid

```tsx
onSetup(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
});
```

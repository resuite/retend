| title                      | impact | impactDescription                                      | tags                           |
| :------------------------- | :----- | :----------------------------------------------------- | :----------------------------- |
| No onSetup for Listeners | CRITICAL | Listeners must be called directly in component body for automatic cleanup. | reactivity, listeners, lifecycle |

# NEVER Wrap .listen() in onSetup

**Context**: Creating side effects that respond to Cell changes.

**Rule**: Call `.listen()` directly in the component body. **NEVER** wrap it in `onSetup`.

**Why**:

- **Automatic Cleanup**: Retend automatically binds listeners created during component execution to the component's lifecycle
- **No Manual Unsubscribe**: When the component unmounts, listeners are cleaned up automatically
- **Simplicity**: No need for effect wrappers or cleanup functions
- **Correct Timing**: Listeners set up immediately, not after first render

## Explicit Anti-Pattern

```tsx
// ❌ WRONG - Never do this
function MyComponent() {
  const count = Cell.source(0);

  onSetup(() => {
    // WRONG: Don't wrap .listen() in onSetup
    const unsubscribe = count.listen((val) => {
      console.log('Count:', val);
    });
    return unsubscribe; // Unnecessary manual cleanup
  });

  return <div>{count}</div>;
}
```

## Explicit Pattern

```tsx
// ✅ CORRECT - Call .listen() directly
function MyComponent() {
  const count = Cell.source(0);

  // CORRECT: Call directly in component body
  count.listen((val) => {
    console.log('Count:', val);
  });
  // Automatic cleanup - no unsubscribe needed!

  return <div>{count}</div>;
}
```

## When to Use onSetup

Use `onSetup` for **non-reactive** setup that runs **once**:

```tsx
// ✅ CORRECT - onSetup for non-reactive setup
onSetup(() => {
  // One-time initialization (not reactive)
  const id = setInterval(() => {
    // This is NOT reactive - runs on timer, not on Cell changes
  }, 1000);

  return () => clearInterval(id);
});

// ✅ CORRECT - .listen() for reactive side effects
count.listen((newValue) => {
  // Reactive - runs whenever count changes
  console.log('Count changed to:', newValue);
});
```

## Decision Flow

```
NEED REACTIVE SIDE EFFECTS?
├─ React to Cell changes → Call .listen() directly in component body
└─ One-time setup (timers, external libs) → Use onSetup()

NEED CLEANUP?
├─ For .listen() → Automatic, no action needed
└─ For onSetup → Return cleanup function
```

## Common Mistakes

| Mistake | Why It's Wrong | Correct Approach |
|---------|---------------|------------------|
| `onSetup(() => cell.listen(...))` | Unnecessary wrapper, manual cleanup | `cell.listen(...)` directly |
| `useEffect(() => cell.listen(...), [])` | React pattern doesn't apply | `cell.listen(...)` directly |
| `const unsub = cell.listen(); return unsub` | Manual cleanup not needed | Just `cell.listen(...)` |

## Quick Reference

**DO**: Call `.listen()` directly in component body
**DON'T**: Wrap `.listen()` in `onSetup`
**DON'T**: Store unsubscribe functions
**DON'T**: Return unsubscribe from onSetup

---

**Remember**: Retend's listener system is designed to "just work" without React-style effect management. Trust the framework to handle cleanup.

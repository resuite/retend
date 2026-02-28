| title          | impact | impactDescription                                    | tags                        |
| :------------- | :----- | :--------------------------------------------------- | :-------------------------- |
| No React Hooks | High   | Enforces proper Retend patterns and prevents errors. | react-migration, hooks, api |

# No React Hooks

**Context**: Importing hooks and component definitions.

**Rule**: Do not use React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`, etc.). Retend uses Cells and `onSetup` instead.

**Why**:

- Retend has a completely different reactivity model based on Cells
- React hooks don't exist in the Retend API
- Using React hooks will cause runtime errors

## Detection

**Triggers**:

- Imports from `react` or `react-dom`
- Identifiers: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`

## Auto-Fix

- Replace `useState` with `Cell.source()`
- Replace `useEffect` with `onSetup()` (one-time) or `cell.listen()` (reactive)
- Replace `useMemo` with `Cell.derived()`
- Replace `useCallback` with a plain function
- Replace `useRef` with `Cell.source(null)`
- Replace `useContext` with `createScope()` + `useScopeContext()`

## Examples

### Invalid

```tsx
// INVALID - these don't exist in Retend
import { useState, useEffect, useMemo, useCallback, useRef } from 'retend';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('Count:', count);
  }, [count]);

  return <div>{count}</div>;
}
```

### Valid

```tsx
// VALID - use Cells instead
import { Cell, onSetup } from 'retend';

function Counter() {
  const count = Cell.source(0);

  onSetup(() => {
    console.log('Count:', count.get());
    return () => {
      // Cleanup if needed
    };
  });

  return <div>{count}</div>;
}
```

## Migration Guide

| React Hook    | Retend Equivalent                                        |
| ------------- | -------------------------------------------------------- |
| `useState`    | `Cell.source()`                                          |
| `useEffect`   | `onSetup()` (runs once) + `cell.listen()` for reactivity |
| `useMemo`     | `Cell.derived()`                                         |
| `useCallback` | Plain function                                           |
| `useRef`      | `Cell.source(null)`                                      |
| `useContext`  | `createScope()` + `useScopeContext()`                    |

## Related Rules

- `no-react-imports`
- `no-usememo-usecallback`
- `no-dependency-arrays`
- `no-re-render-optimization`

| title               | impact | impactDescription                                                       | tags                                 |
| :------------------ | :----- | :---------------------------------------------------------------------- | :----------------------------------- |
| Derived Outside JSX | MEDIUM | Improves performance by avoiding re-creation and keeps templates clean. | components, performance, readability |

# Derived Outside JSX

**Context**: Computing values from Cells.

**Rule**: Define `Cell.derived()` logic in the component body, not inline within the JSX expression.

**Why**:

- **Performance**: Inline derivations may be recreated unnecessarily.
- **Readability**: Keeps the template clean and declarative.

```tsx
// Bad
<div>{Cell.derived(() => count.get() * 2)}</div>;

// Good
const doubled = Cell.derived(() => count.get() * 2);
return <div>{doubled}</div>;
```

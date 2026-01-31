| title               | impact | impactDescription              | tags              |
| :------------------ | :----- | :----------------------------- | :---------------- |
| Derived Outside JSX | LOW    | Keeps templates clean.         | components, style |

# Derived Outside JSX

**Rule**: Define `Cell.derived()` in the component body, not inline in JSX.

**Why**: Cleaner templates. Separates logic from presentation.

```tsx
// Bad
<div>{Cell.derived(() => count.get() * 2)}</div>;

// Good
const doubled = Cell.derived(() => count.get() * 2);
return <div>{doubled}</div>;
```

| title            | impact | impactDescription                                         | tags                           |
| :--------------- | :----- | :-------------------------------------------------------- | :----------------------------- |
| Refs on Elements | HIGH   | Ensures safe handling of null-initial refs in TypeScript. | components, typescript, safety |

# Refs on Elements

**Context**: Accessing DOM elements.

**Rule**: Use `Cell.source(null)` to create refs. In TypeScript, always type them as `<HTMLElement | null>`.

**Why**:

- **Type Safety**: Ensures correct handling of the null initial state.
- **Reactivity**: Cells serve as reactive references.

```tsx
const inputRef = Cell.source<HTMLInputElement | null>(null);
```

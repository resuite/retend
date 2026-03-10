| title               | impact | impactDescription                              | tags                                 |
| :------------------ | :----- | :--------------------------------------------- | :----------------------------------- |
| Keep Cells Granular | HIGH   | Improves performance by minimizing re-renders. | reactivity, performance, granularity |

# Keep Cells Granular

**Context**: Defining state with `Cell.source()`.

**Rule**: Store separate pieces of state in separate Cells rather than grouping unrelated state into a single object Cell.

**Why**:

- **Performance**: Changing one property of an object Cell triggers updates for _all_ dependents, even if they only needed a different property.
- **Granularity**: Smaller atoms of state are easier to compose.

```tsx
// Good
const firstName = Cell.source('John');
const age = Cell.source(30);

// Avoid (unless properties are strictly related)
const user = Cell.source({ firstName: 'John', age: 30 });
```

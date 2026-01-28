| title                         | impact | impactDescription                               | tags                               |
| :---------------------------- | :----- | :---------------------------------------------- | :--------------------------------- |
| Decrease usage of Route Names | LOW    | Reduces reliance on fragile string identifiers. | routing, maintenance, anti-pattern |

# Decrease usage of Route Names

**Context**: Defining route records.

**Rule**: Avoid using the `name` property on routes. Prefer navigating by path or typed route objects.

**Why**:

- **Singular Source of Truth**: The path is the single source of truth for navigation.
- **Refactoring**: Renaming a route requires updating all name references, whereas paths are often structural.

```tsx
// Avoid
// router.navigate({ name: 'user-edit', params: { id: 1 } })

// Prefer
// router.navigate('/user/1/edit')
```

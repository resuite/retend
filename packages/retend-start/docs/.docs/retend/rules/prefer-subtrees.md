| title           | impact | impactDescription                                                     | tags                            |
| :-------------- | :----- | :-------------------------------------------------------------------- | :------------------------------ |
| Prefer Subtrees | HIGH   | Significantly improves code organization and bundling for large apps. | routing, performance, structure |

# Prefer Subtrees

**Context**: Defining large route configurations.

**Rule**: Use `subtree` to split large route trees into separate modules/files.

**Why**:

- **Code Organization**: Keeps route files manageable and focused.
- **Bundling**: Allows bundlers to easier split chunks (if using lazy subtrees).

```tsx
// Good
import { subtree } from 'retend/router';

const routes = [
  subtree('/admin', () => import('./admin.routes')),
  subtree('/dashboard', dashboardRoutes),
];
```

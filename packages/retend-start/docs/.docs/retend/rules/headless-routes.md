| title                             | impact | impactDescription                                                       | tags                        |
| :-------------------------------- | :----- | :---------------------------------------------------------------------- | :-------------------------- |
| Use Headless Routes for Structure | MEDIUM | Improves maintainability by grouping related routes without UI nesting. | routing, structure, nesting |

# Use Headless Routes for Structure

**Context**: Grouping routes that share a path prefix but not a UI layout.

**Rule**: Use a "headless" route (a route with `children` but no `component`) to group related routes.

**Why**:

- **Organization**: logically groups related routes.
- **Path structure**: avoids repeating parent paths.

```tsx
// Good
{
  path: '/settings',
  // No component here, just grouping
  children: [
    { path: 'profile', component: Profile },
    { path: 'security', component: Security }
  ]
}
```

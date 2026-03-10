| title         | impact | impactDescription                              | tags                              |
| :------------ | :----- | :--------------------------------------------- | :-------------------------------- |
| Prefer Scopes | MEDIUM | Improves component decoupling and maintenance. | composition, scopes, architecture |

# Prefer Scopes

**Context**: Passing data deeply through the tree.

**Rule**: Use Scopes instead of prop drilling (passing data through intermediate components that don't need it).

**Why**:

- **Coupling**: Reduces coupling between intermediate components and the data they pass.
- **Maintenance**: Easier to refactor or move components when they don't depend on unrelated props.

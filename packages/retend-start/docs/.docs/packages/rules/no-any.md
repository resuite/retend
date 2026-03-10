| title  | impact | impactDescription                               | tags                            |
| :----- | :----- | :---------------------------------------------- | :------------------------------ |
| No Any | HIGH   | Maintains type safety and prevents hidden bugs. | composition, typescript, safety |

# No Any

**Context**: Typing props and variables.

**Rule**: Never use `any`. Use `unknown` if the type is truly not known, or generic types.

**Why**:

- **Safety**: `any` defeats the purpose of TypeScript and hides bugs.

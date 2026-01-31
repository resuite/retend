| title                  | impact | impactDescription                        | tags                            |
| :--------------------- | :----- | :--------------------------------------- | :------------------------------ |
| Prefer Input Component | MEDIUM | Reduces boilerplate for two-way binding. | components, forms, productivity |

# Prefer Input Component

**Context**: Building forms.

**Rule**: Use the `Input` component from `retend-utils` instead of raw `<input>` tags for two-way binding.

**Why**:

- **Simplicity**: Automatically binds to a Cell without manual `value` and `onChange` wiring.
- **Less Boilerplate**: Reduces code volume significantly.

```tsx
// Good
<Input model={nameCell} />
```

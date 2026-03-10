| title           | impact   | impactDescription                                        | tags                         |
| :-------------- | :------- | :------------------------------------------------------- | :--------------------------- |
| Top-Level Hooks | CRITICAL | Ensures consistent hook ordering for state preservation. | components, hooks, stability |

# Top-Level Hooks

**Context**: Using `use*` functions (hooks).

**Rule**: Always call hooks at the top level of your component function. Never call them inside loops, conditions, or nested functions.

**Why**:

- **Consistency**: The framework relies on the call order to maintain state between renders (even in fine-grained reactive systems, scope consistency matters).

```tsx
// Bad
if (condition) {
  useHook(); // Error!
}

// Good
useHook();
if (condition) { ... }
```

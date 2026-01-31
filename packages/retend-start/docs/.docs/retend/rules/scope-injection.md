| title           | impact   | impactDescription                                           | tags                             |
| :-------------- | :------- | :---------------------------------------------------------- | :------------------------------- |
| Scope Injection | CRITICAL | Ensures children can access the provided scope immediately. | composition, scopes, correctness |

# Scope Injection

**Context**: Components that provide a Scope to their subtree.

**Rule**: If a component injects a Scope, its `children` prop MUST be a function.

**Why**:

- **Laziness**: Allows the scope to be accessed by the immediate children. If children are evaluated before the provider renders, they won't see the new scope.

```tsx
// Good
<Scope.Provider value={val}>
  {() => <Child />}
</Scope.Provider>

// Avoid for Providers
<Scope.Provider value={val}>
  <Child /> {/* Child evaluates eagerly, potentially missing Scope */}
</Scope.Provider>
```

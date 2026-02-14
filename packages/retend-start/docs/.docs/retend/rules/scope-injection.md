| title           | impact   | impactDescription                                           | tags                             |
| :-------------- | :------- | :---------------------------------------------------------- | :------------------------------- |
| Scope Injection | CRITICAL | Ensures children can access the provided scope immediately. | composition, scopes, correctness |

# Scope Injection

**Context**: Components that provide a Scope to their subtree.

**Rule**: If a component injects a Scope, it must pass direct children, not function children.

**Why**:

- **Thunk-first rendering**: Providers now establish scope context before children execute, so direct children see the scope without function wrapping.

```tsx
// Good
<Scope.Provider value={val}>
  <Child />
</Scope.Provider>

// Avoid for Providers
<Scope.Provider value={val}>
  {() => <Child />}
</Scope.Provider>
```

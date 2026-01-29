| title               | impact | impactDescription                          | tags           |
| :------------------ | :----- | :----------------------------------------- | :------------- |
| Combine Scopes Keys | High   | Essential for correct scope value mapping. | scopes, syntax |

# Combine Scopes Keys

**Rule**: When using `combineScopes`, the value object provided to the Provider MUST use computed property names `[Scope.key]` for each scope's value.

**Why**:

- **Correctness**: `combineScopes` relies on these internal keys to distribute values to the correct consumers. Using arbitrary keys will fail to provide the values.

## Examples

### Invalid

```tsx
const Combined = combineScopes(ScopeA, ScopeB);

// Keys 'ScopeA' and 'ScopeB' will NOT work
<Combined.Provider value={{ ScopeA: valA, ScopeB: valB }} />;
```

### Valid

```tsx
const Combined = combineScopes(ScopeA, ScopeB);

// Use computed keys
<Combined.Provider
  value={{
    [ScopeA.key]: valA,
    [ScopeB.key]: valB,
  }}
/>;
```

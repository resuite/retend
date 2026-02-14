| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Scope Provider Function Children | High | Ensures proper scope context propagation.              | scopes, providers, context  |

# Scope Provider Children

**Context**: Using Scope providers to pass context.

**Rule**: Pass children directly to Scope providers. Do not use function children or the `content` prop.

**Why**:

- Components are now evaluated as thunks by the renderer, so provider context is established before children execute.
- Function-children and `content` are no longer supported.
- A single children-only API prevents mixed patterns and keeps scopes consistent.

## Examples

### Valid

```tsx
// VALID - Direct children
<MyScope.Provider value={data}>
  <Child />
</MyScope.Provider>

// VALID - Children with props
<MyScope.Provider value={data}>
  <Child prop1={value1} prop2={value2} />
</MyScope.Provider>
```

### Invalid

```tsx
// INVALID - Function children no longer supported
<MyScope.Provider value={data}>
  {() => <Child />}
</MyScope.Provider>

// INVALID - content prop is removed
// (content prop no longer supported)
```

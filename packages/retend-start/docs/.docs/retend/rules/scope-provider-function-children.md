| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Scope Provider Function Children | High | Ensures proper scope context propagation.              | scopes, providers, context  |

# Scope Provider Function Children

**Context**: Using Scope providers to pass context.

**Rule**: Always pass children as a function to Scope providers, or use the `content` prop.

**Why**:

- Scope providers need to inject context before children render
- Passing JSX directly executes it immediately, outside the scope
- Function children delay execution until inside the scope context

## Examples

### Invalid

```tsx
// INVALID - Child renders outside scope context
<MyScope.Provider value={data}>
  <Child />
</MyScope.Provider>
```

### Valid

```tsx
// VALID - Function children execute inside scope
<MyScope.Provider value={data}>
  {() => <Child />}
</MyScope.Provider>

// Also VALID - Using content prop
<MyScope.Provider value={data} content={Child} />

// Also VALID - For components with props
<MyScope.Provider value={data}>
  {() => <Child prop1={value1} prop2={value2} />}
</MyScope.Provider>
```

## Common Pattern: Wrapper Component

```tsx
// Create a wrapper that handles the function pattern
function ScopedProvider({ value, children }) {
  return (
    <MyScope.Provider value={value}>
      {typeof children === 'function' ? children : () => children}
    </MyScope.Provider>
  );
}

// Usage
<ScopedProvider value={user}>
  <UserProfile />
</ScopedProvider>
```

## Why This Matters

```tsx
const UserScope = createScope('UserScope');

function UserProfile() {
  const user = useScopeContext(UserScope); // Throws if no provider!
  return <div>{user.name}</div>;
}

// INVALID - throws error
<UserScope.Provider value={currentUser}>
  <UserProfile /> {/* Executed immediately, no context yet */}
</UserScope.Provider>

// VALID - works correctly
<UserScope.Provider value={currentUser}>
  {() => <UserProfile />} {/* Executed inside scope context */}
</UserScope.Provider>
```

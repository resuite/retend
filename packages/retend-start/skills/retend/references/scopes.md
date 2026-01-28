# Scopes

Scopes provide a way to share state between components that are far apart in the component tree, avoiding "prop drilling". They allow you to broadcast data to a whole tree of components.

## Core API

### `createScope()`

Creates a new, unique scope object. Best practice is to create this in a separate file for easy import.

```javascript
import { createScope } from 'retend';

export const ThemeScope = createScope();
```

### `Scope.Provider`

A component that provides a value to all its children. It takes a `value` prop and a function as its `children`.

```jsx
import { ThemeScope } from './scopes.js';

function App() {
  const theme = 'dark';

  return (
    <ThemeScope.Provider value={theme}>
      {() => <AuthenticatedLayout />}
    </ThemeScope.Provider>
  );
}
```

### `useScopeContext()`

A hook that lets a component read a value from the nearest matching `Scope.Provider` above it in the tree.

```jsx
import { useScopeContext } from 'retend';
import { ThemeScope } from './scopes.js';

function StatusIndicator() {
  const theme = useScopeContext(ThemeScope);
  return <div class={`status-${theme}`}></div>;
}
```

## Advanced Patterns

### Combine Scopes

For applications with multiple scopes, usage of `combineScopes` avoids the "pyramid of doom" of nested providers.

```jsx
import { combineScopes } from 'retend';

const AppScopes = combineScopes(AuthScope, ThemeScope, LanguageScope);

function Root() {
  const scopeValues = {
    [AuthScope.key]: user,
    [ThemeScope.key]: theme,
    [LanguageScope.key]: lang,
  };

  return (
    <AppScopes.Provider value={scopeValues}>{() => <App />}</AppScopes.Provider>
  );
}
```

## Why Scopes?

1.  **Isolation**: Unlike global variables, Scopes allow multiple independent states for the same scope within a single app (e.g., side-by-side previews).
2.  **Lifecycle Management**: State tied to a provider is destroyed when the provider unmounts, preventing memory leaks (e.g., form data state).

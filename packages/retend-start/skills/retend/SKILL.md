---
name: retend
description: Reactive JSX framework using Cells for fine-grained reactivity. Use when building applications.
---

# Retend

Retend is a reactive JSX framework that uses **Cells** for fine-grained reactivity.

## Quick Start

### 1. Basic Component with Reactive State

```tsx
import { Cell } from 'retend';

function Counter() {
  const count = Cell.source(0);
  const doubled = Cell.derived(() => count.get() * 2);

  const increment = () => count.set(count.get() + 1);

  return (
    <div>
      <button onClick={increment}>Clicks: {count}</button>
      <p>Doubled: {doubled}</p>
    </div>
  );
}
```

### 2. Control Flow (Use Instead of Inline Conditionals)

```tsx
import { Cell, If, For } from 'retend';

function TodoList() {
  const todos = Cell.source([
    { id: 1, text: 'Learn Retend', done: false },
    { id: 2, text: 'Build app', done: false },
  ]);
  const hasTodos = Cell.derived(() => todos.get().length > 0);

  return (
    <div>
      {If(hasTodos, {
        true: () => (
          <ul>
            {For(todos, (todo) => (
              <li>{todo.text}</li>
            ))}
          </ul>
        ),
        false: () => <p>No todos yet!</p>,
      })}
    </div>
  );
}
```

### 3. Event Modifiers

```tsx
function Form() {
  const handleSubmit = (e) => {
    console.log('Form submitted, default prevented, bubbling stopped');
  };

  return (
    <form onSubmit--prevent--stop={handleSubmit}>
      <input type="text" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### 4. Two-Way Binding with Input Component

```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function LoginForm() {
  const username = Cell.source('');
  const password = Cell.source('');

  return (
    <form>
      <Input type="text" model={username} placeholder="Username" />
      <Input type="password" model={password} placeholder="Password" />
      <p>Username: {username}</p>
    </form>
  );
}
```

## Core Concepts

### Cells (Reactive Primitives)

- `Cell.source(value)` - Mutable reactive state
- `Cell.derived(() => computation)` - Auto-updates when dependencies change
- `.get()` - Read value
- `.set(value)` - Update value (source cells only)
- `.peek()` - Read without tracking dependency

**For complete Cell API →** see `references/cells-api.md`

### Control Flow Directives

- `If(condition, { true, false })` - Conditional rendering
- `For(items, (item) => jsx)` - List rendering with automatic keying
- `Switch(value, { cases })` - Multi-branch conditionals
- `useSetupEffect(callback)` - Run setup/cleanup logic
- `useObserver()` - Observe DOM element lifecycle

**For detailed control flow guide →** see `references/control-flow.md`

### Routing

```tsx
import { Router, lazy } from 'retend/router';

const router = new Router({
  routes: [
    { path: '/', component: lazy(() => import('./pages/Home')) },
    { path: '/about', component: lazy(() => import('./pages/About')) },
    { path: '/users/:id', component: lazy(() => import('./pages/User')) },
  ],
});

// Navigate programmatically
router.navigate('/users/123?tab=profile');
```

**For complete routing guide (params, queries, nested routes, lazy loading) →** see `references/routing.md`

### Retend Utils

Additional hooks and components for common patterns:

**Hooks:** useElementBounding, useLiveDate, useWindowSize, useOnlineStatus, useStorage, useDerivedValue, useMatchMedia, useCursorPosition, useIntersectionObserver, useClickCoordinates, useDocumentVisibility

**Components:** Input (two-way binding), FluidList (animated lists), createUniqueTransition (FLIP animations)

**For complete utils reference →** see `references/retend-utils.md`

### Scopes (Context)

- `createScope()` - Create a context scope
- `Scope.Provider` - Provide values to children
- `useScopeContext(Scope)` - Consume values from provider

**For complete scopes guide →** see `references/scopes.md`

### Advanced Components

- `createUnique` - Persist component identity across moves

**For details →** see `references/advanced-components.md` (For Teleport/ShadowRoot see `retend-web` skill)

## Common Patterns

### Form with Validation

```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function SignupForm() {
  const email = Cell.source('');
  const isValid = Cell.derived(() => email.get().includes('@'));

  const handleSubmit = () => {
    if (isValid.get()) {
      console.log('Valid!', email.get());
    }
  };

  return (
    <form onSubmit--prevent={handleSubmit}>
      <Input type="email" model={email} />
      {If(isValid, {
        false: () => <span style={{ color: 'red' }}>Invalid email</span>,
      })}
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### Animated List with FluidList

```tsx
import { Cell } from 'retend';
import { FluidList } from 'retend-utils/components';

function AnimatedTodos() {
  const items = Cell.source([
    { id: 1, text: 'First' },
    { id: 2, text: 'Second' },
  ]);

  return (
    <FluidList
      items={items}
      itemKey="id"
      itemHeight="50px"
      gap="10px"
      staggeredDelay="50ms"
      Template={({ item }) => <div class="todo-item">{item.text}</div>}
    />
  );
}
```

### Route with Params and Query

```tsx
import { Cell } from 'retend';
import { useCurrentRoute, useRouteQuery } from 'retend/router';

function UserProfile() {
  const route = useCurrentRoute(); // Cell<RouteData>
  const query = useRouteQuery(); // AsyncRouteQuery

  const userId = Cell.derived(() => route.get().params.get('id'));
  const tab = Cell.derived(() => query.get('tab').get() || 'overview');

  return (
    <div>
      <h1>User: {userId}</h1>
      <p>Current tab: {tab}</p>
    </div>
  );
}
```

## Bundled Resources

### References

- **cells-api.md** - Complete Cell API reference with all methods and patterns
- **control-flow.md** - Detailed guide to If/For/Switch/Observer with examples
- **routing/setup.md** - Router initialization, lazy loading, subtrees, and 404s
- **routing/navigation.md** - Navigation hooks, Link component, and Active state
- **routing/data.md** - Dynamic route params and query parameters
- **routing/middleware.md** - Router middleware and redirects
- **routing/advanced.md** - Nested routes, Locking, Stack Mode, View Transitions
- **retend-utils.md** - Complete reference for all hooks and components in retend-utils
- **scopes.md** - Guide to Context API (Scopes), Providers, and useScopeContext
- **element-references.md** - Using refs with Cells for direct DOM manipulation

### Rules

- [prefer-subtrees.md](rules/prefer-subtrees.md) - Use `subtree` for large route trees.
- [headless-routes.md](rules/headless-routes.md) - Use headless routes for grouping.
- [avoid-route-names.md](rules/avoid-route-names.md) - Avoid using `name` field.
- [keep-cells-granular.md](rules/keep-cells-granular.md) - Keep state granular.
- [pure-derived-cells.md](rules/pure-derived-cells.md) - Derived cells must be pure.
- [use-peek.md](rules/use-peek.md) - Use `.peek()` for non-reactive reads.
- [component-scoped-listeners.md](rules/component-scoped-listeners.md) - Listeners inside components.
- [use-builtin-control-flow.md](rules/use-builtin-control-flow.md) - Use `If`/`For` helpers.
- [pure-render-callbacks.md](rules/pure-render-callbacks.md) - Render callbacks must be pure.
- [top-level-hooks.md](rules/top-level-hooks.md) - Only call hooks at top level.
- [prefer-input-component.md](rules/prefer-input-component.md) - Use `Input` helper.
- [refs-on-elements.md](rules/refs-on-elements.md) - Safe ref creation and typing.
- [pass-cells-directly.md](rules/pass-cells-directly.md) - Don't unwrap cells in JSX.
- [derived-outside-jsx.md](rules/derived-outside-jsx.md) - Define derived state outside JSX.
- [no-argument-destructuring.md](rules/no-argument-destructuring.md) - Destructure props in body.
- [customizable-components.md](rules/customizable-components.md) - Favor extension over invention.
- [explicit-children-type.md](rules/explicit-children-type.md) - Use `JSX.Children`.
- [scope-injection.md](rules/scope-injection.md) - Use function children for scopes.
- [no-any.md](rules/no-any.md) - No `any` type.
- [reactive-props.md](rules/reactive-props.md) - Handle ValueOrCell props.
- [prefer-scopes.md](rules/prefer-scopes.md) - Avoid prop drilling.
- [self-closing-tags.md](rules/self-closing-tags.md) - Used self-closing tags.
- [button-type.md](rules/button-type.md) - Always set button type.
- [use-for-attribute.md](rules/use-for-attribute.md) - Use `for` not `htmlFor`.
- [prefer-event-modifiers.md](rules/prefer-event-modifiers.md) - Use modifiers.
- [unique-component-ids.md](rules/unique-component-ids.md) - Unique IDs for `createUnique`.
- [component-structure.md](rules/component-structure.md) - Order of internals.
- [svg-xmlns.md](rules/svg-xmlns.md) - Required xmlns for SVG.
- [use-link-component.md](rules/use-link-component.md) - Use `Link` for internal navigation.
- [no-ternary.md](rules/no-ternary.md) - **No** ternary operators in JSX.
- [function-children-as-component.md](rules/function-children-as-component.md) - Render function children as components.
- [combine-scopes-keys.md](rules/combine-scopes-keys.md) - Use `[Scope.key]` for combined scopes.
- [component-pascal-case.md](rules/component-pascal-case.md) - Use PascalCase for components.
- [hoist-handlers.md](rules/hoist-handlers.md) - Hoist event handlers.
- [prefer-router-navigation.md](rules/prefer-router-navigation.md) - Use router for navigation.
- **advanced-components.md** - Guide to createUnique (persistent identity).

### Scripts

- **create_component.py** - Generate boilerplate Retend components
- **validate_routing.py** - Validate route configuration for common issues

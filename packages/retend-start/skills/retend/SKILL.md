---
name: retend
description: Reactive JSX framework using Cells for fine-grained reactivity. Use when building Retend applications.
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

  return (
    <div>
      <button onClick={() => count.set(count.get() + 1)}>
        Clicks: {count}
      </button>
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
  return (
    <form
      onSubmit--prevent--stop={(e) => {
        console.log('Form submitted, default prevented, bubbling stopped');
      }}
    >
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

### Event Modifiers

Chain modifiers with `--`: `onClick--prevent--stop--once={handler}`

Available modifiers:

- `--prevent` - preventDefault()
- `--stop` - stopPropagation()
- `--once` - Fire only once
- `--self` - Only if target is element itself
- `--passive` - Passive event listener

**For all modifier combinations and examples →** see `references/event-modifiers.md`

### Routing

```tsx
import { Router, lazy } from 'retend/router';

const router = new Router({
  routes: [
    { path: '/', component: () => lazy(import('./pages/Home')) },
    { path: '/about', component: () => lazy(import('./pages/About')) },
    { path: '/users/:id', component: () => lazy(import('./pages/User')) },
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

## Common Patterns

### Form with Validation

```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function SignupForm() {
  const email = Cell.source('');
  const isValid = Cell.derived(() => email.get().includes('@'));

  return (
    <form
      onSubmit--prevent={(e) => {
        if (isValid.get()) {
          console.log('Valid!', email.get());
        }
      }}
    >
      <Input type="email" model={email} />
      {If(isValid, {
        false: () => <span style="color: red">Invalid email</span>,
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
- **routing.md** - Full routing documentation (setup, navigation, params, queries, lazy loading, nested routes)
- **event-modifiers.md** - All event modifiers with combinations and use cases
- **retend-utils.md** - Complete reference for all hooks and components in retend-utils

### Scripts

- **create_component.py** - Generate boilerplate Retend components
- **validate_routing.py** - Validate route configuration for common issues

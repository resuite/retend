---
description: Routing patterns for Retend Router. Covers navigation, route structure, query parameters, and best practices.
---

# Routing Patterns

**Purpose**: Implement client-side routing with proper navigation and state management.

**CRITICAL PRINCIPLE**: Always use the Router API for navigation. Never use window.location methods.

---

## [CRITICAL] Always Use Router Navigation

**Applies to**: All programmatic navigation

**Rule**: Use the Router's `navigate()` method. Never use `window.location` or `window.history` directly.

**Explicit Anti-Pattern**:

```tsx
// ❌ WRONG - causes full page reload
const goToHome = () => {
  window.location.href = '/home';
  window.location.assign('/home');
  window.history.pushState({}, '', '/home');
};
```

**Explicit Pattern**:

```tsx
import { useRouter } from 'retend/router';

// ✅ CORRECT - client-side navigation
function Navigation() {
  const router = useRouter();

  const goToHome = () => {
    router.navigate('/home');
  };

  const goToUser = (userId: number) => {
    router.navigate(`/users/${userId}`);
  };

  // Event handlers should be hoisted, not inline
  const handleGoToUser = () => {
    goToUser(123);
  };

  return (
    <nav>
      <button type="button" onClick={goToHome}>
        Home
      </button>
      <button type="button" onClick={handleGoToUser}>
        User 123
      </button>
    </nav>
  );
}
```

**Why**: Window location methods cause full page reloads, destroying application state. Router navigation is fast and preserves state.

---

## [CRITICAL] Use Link Component for Navigation

**Applies to**: All internal navigation links

**Rule**: Use the `Link` component from `retend/router` instead of `<a>` tags for internal navigation.

**Explicit Pattern**:

```tsx
import { Link } from 'retend/router';

// ✅ CORRECT - client-side Link
function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/users">Users</Link>
      <Link href="/contact">Contact</Link>
    </nav>
  );
}
```

**Explicit Anti-Pattern**:

```tsx
// ❌ WRONG - regular anchor causes reload
<nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

**External Links**:

```tsx
// ✅ CORRECT - use <a> for external
<a href="https://example.com" target="_blank" rel="noopener">
  External Site
</a>
```

**Link Component Benefits**:

- Client-side navigation (no reload)
- Active state handling
- Preserves application state
- Better performance

---

## [WARNING] Router Setup Pattern

**Applies to**: Application initialization

**Rule**: Set up the router with routes and render the Router outlet.

**Explicit Pattern**:

```tsx
import { Router, Link, createRouterRoot } from 'retend/router';
import { setActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';

import { Outlet } from 'retend/router';

function AppLayout() {
  return (
    <div>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/users">Users</Link>
      </nav>
      <main>
        <Outlet /> {/* Renders matched route */}
      </main>
    </div>
  );
}

// Define routes
const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', component: HomePage },
      { path: 'about', component: AboutPage },
      {
        path: 'users',
        component: UsersLayout,
        children: [
          { path: '', component: UserList },
          { path: ':id', component: UserDetail },
        ],
      },
    ],
  },
  { path: '*', component: NotFoundPage }, // 404 catch-all
];

// Create router
const router = new Router({ routes });

const renderer = new DOMRenderer(window);
setActiveRenderer(renderer);

// Render
document.body.append(createRouterRoot(router));
```

---

## [WARNING] Use Headless Routes for Grouping

**Applies to**: Route organization and structure

**Rule**: Use headless routes (routes with `children` but no `component`) to group related routes.

**Explicit Pattern**:

```tsx
const routes = [
  {
    path: '/settings',
    // No component - headless route for grouping
    children: [
      { path: 'profile', component: ProfileSettings },
      { path: 'security', component: SecuritySettings },
      { path: 'notifications', component: NotificationSettings },
    ],
  },
];

// Results in:
// /settings/profile
// /settings/security
// /settings/notifications
```

**Why**:

- Logical grouping of related routes
- Avoids repeating parent paths
- Cleaner route definitions

---

## [WARNING] Use Subtrees for Large Apps

**Applies to**: Large route configurations

**Rule**: Use `subtree` with `defineRoute` and `lazy` to split routes into separate modules.

**Explicit Pattern**:

```tsx
import { Router, lazy } from 'retend/router';

// Main routes file
const router = new Router({
  routes: [
    { path: '/', component: HomePage },

    // Lazy-loaded subtree
    {
      path: '/admin',
      subtree: lazy(() => import('./routes/admin'))
    },

    { path: '*', component: NotFoundPage }
  ]
});

// routes/admin.ts
import { defineRoute, lazy } from 'retend/router';

export default defineRoute({
  path: '/admin', // Must match parent path
  component: lazy(() => import('./AdminLayout')),
  children: [
    { path: 'users', component: lazy(() => import('./AdminUsers')) },
    { path: 'settings', component: lazy(() => import('./AdminSettings')) }
];
```

**Benefits**:

- Code splitting and lazy loading
- Better organization
- Smaller initial bundle

---

## [WARNING] Avoid Route Names

**Applies to**: Route navigation

**Rule**: Navigate by path, not by route name.

**Explicit Anti-Pattern**:

```tsx
// ❌ WRONG - fragile string names
router.navigate({ name: 'user-edit', params: { id: 1 } });
```

**Explicit Pattern**:

```tsx
// ✅ CORRECT - navigate by path
router.navigate('/users/1/edit');

// Or with template literals
const userId = 1;
router.navigate(`/users/${userId}/edit`);
```

**Why**: Paths are the single source of truth. Names add indirection and breakage.

---

## [CRITICAL] Dynamic Route Parameters

**Applies to**: Routes with variable segments

**Rule**: Use `:paramName` syntax for dynamic segments. Access via `useCurrentRoute()`.

**Explicit Pattern**:

```tsx
// Route definition
const routes = [
  {
    path: '/users/:userId/posts/:postId',
    component: PostDetail,
  },
];

// Component using params
import { useCurrentRoute } from 'retend/router';

function PostDetail() {
  const route = useCurrentRoute();

  const post = Cell.derivedAsync(async (get) => {
    const params = route.get().params;
    const userId = params.get('userId');
    const postId = params.get('postId');
    return await fetchPost(userId, postId);
  });

  const title = Cell.derived(() => post.get()?.title ?? '');

  return (
    <article>
      {If(post.pending, { true: () => <div>Loading...</div> })}
      {If(post.error, { true: (err) => <div>Error: {err.message}</div> })}
      {If(post, { true: () => <h1>{title}</h1> })}
    </article>
  );
}
```

**Key Point**: Access params via `useCurrentRoute().get().params.get('paramName')`.

---

## [CRITICAL] Query Parameters Are Async

**Applies to**: Modifying URL query parameters

**Rule**: Query mutations (`set`, `append`, `delete`, `clear`) return Promises. Always await them.

**Explicit Pattern**:

```tsx
import { useRouteQuery } from 'retend/router';

function FilterComponent() {
  const query = useRouteQuery();

  // ✅ CORRECT - await query mutations
  const handleFilterChange = async (value: string) => {
    await query.set('filter', value);
    // Now safe to fetch with new params
    fetchData();
  };

  const handleClearFilters = async () => {
    await query.clear();
    fetchData();
  };

  const handleSelectChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    handleFilterChange(value);
  };

  return (
    <select onChange={handleSelectChange}>
      <option value="">All</option>
      <option value="active">Active</option>
    </select>
  );
}
```

**Explicit Anti-Pattern**:

```tsx
// ❌ WRONG - not awaiting
const handleChange = (value: string) => {
  query.set('filter', value); // Returns Promise!
  fetchData(); // May run with OLD query params
};
```

**Query API Reference**:

```tsx
const query = useRouteQuery();

// All mutations return Promise<void>
await query.set('key', 'value'); // Set/replace value
await query.append('key', 'value'); // Add to array
await query.delete('key'); // Remove parameter
await query.clear(); // Remove all

// Reads return Cells (reactive)
const value = query.get('key'); // Cell<string | null>
const exists = query.has('key'); // Cell<boolean>
const allParams = query.getAll('key'); // Cell<string[]>
```

---

## [WARNING] Reactive Query Patterns

**Applies to**: Using query parameters reactively

**Rule**: Use Cells returned from `query.get()` for reactive data fetching.

**Explicit Pattern**:

```tsx
function ProductList() {
  const query = useRouteQuery();

  // Get reactive Cell for query param
  const categoryFilter = query.get('category');
  const sortOrder = query.get('sort');

  // ✅ CORRECT - reactive derived cell
  const products = Cell.derivedAsync(async (get) => {
    const category = get(categoryFilter);
    const sort = get(sortOrder);
    return await fetchProducts({ category, sort });
  });

  return (
    <div>
      {If(products.pending, { true: () => <div>Loading...</div> })}
      <ul>
        {For(products, (product) => (
          <li>{product.get().name}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Why**: Query params as Cells enable automatic re-fetching when URL changes.

---

## [WARNING] Router Middleware

**Applies to**: Route guards and global navigation handling

**Rule**: Use middleware for authentication, logging, or redirects.

**Explicit Pattern**:

```tsx
import { Router, defineRouterMiddleware, redirect } from 'retend/router';

// Define middleware using helper
const authMiddleware = defineRouterMiddleware(({ to }) => {
  const isLoggedIn = checkUserSession();
  if (to.metadata.get('requiresAuth') && !isLoggedIn) {
    return redirect('/login');
  }
});

const loggingMiddleware = defineRouterMiddleware(({ to }) => {
  console.log('Navigating to:', to.path);
});

const router = new Router({
  routes,
  middlewares: [authMiddleware, loggingMiddleware],
});
```

---

## [WARNING] Navigation Hooks

**Applies to**: Reacting to navigation events

**Rule**: Use router hooks for navigation awareness.

**Explicit Pattern**:

```tsx
import { useCurrentRoute, useRouter } from 'retend/router';

function PageComponent() {
  const route = useCurrentRoute();
  const router = useRouter();

  // Current route info (access via .get() since route is a Cell)
  const path = route.get().path; // string
  const params = route.get().params; // Map<string, string>

  return <div>Current path: {path}</div>;
}
```

---

## Quick Decision Flow

```
NEED TO NAVIGATE?
├─ Click/link → <Link href="/path">Text</Link>
├─ Programmatic → router.navigate('/path')
└─ External → <Link href="https://...">Text</Link> (Link auto-detects external URLs)

NEED DYNAMIC SEGMENTS?
├─ Route definition → path: '/users/:userId'
└─ Access params → useCurrentRoute().get().params.get('userId')

NEED QUERY PARAMS?
├─ Read → query.get('key') returns Cell
├─ Write → await query.set('key', value)
├─ Delete → await query.delete('key')
└─ Clear → await query.clear()

LARGE APP?
├─ Group routes → Headless routes with children
└─ Code split → { path: '/admin', subtree: lazy(() => import('./routes/admin')) }

NEED GUARDS?
└→ defineRouterMiddleware() + middlewares: [...] in Router
```

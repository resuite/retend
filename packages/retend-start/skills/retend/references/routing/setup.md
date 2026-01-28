# Routing Setup

## Overview

Retend includes a built-in router with support for lazy loading, params, query strings, and nested routes.

## Basic Setup

### Router Initialization

```tsx
import { Router, lazy } from 'retend/router';

// Simple object-based route configuration
const router = new Router({
  routes: [
    { path: '/', component: lazy(() => import('./pages/Home')) },
    { path: '/about', component: lazy(() => import('./pages/About')) },
    { path: '/users/:id', component: lazy(() => import('./pages/User')) },
  ],
});
```

### Route Records (Alternative Syntax)

```tsx
import { Router, type RouteRecords } from 'retend/router';

const Home = () => <div>Home</div>;
const About = () => <div>About</div>;

const routes: RouteRecords = [
  { path: '/', component: Home },
  { path: '/about', component: About },
  {
    path: '/users/:userId',
    component: lazy(() => import('./pages/User')),
  },
];

const router = new Router({ routes });
```

**Note:** Each route needs at least `path` and `component` (or `children`).

## Lazy Loading

Lazy load route components for better performance:

```tsx
const router = new Router({
  routes: [
    { path: '/', component: lazy(() => import('./pages/Home')) },
    { path: '/dashboard', component: lazy(() => import('./pages/Dashboard')) },
    { path: '/profile', component: lazy(() => import('./pages/Profile')) },
  ],
});
```

**Benefits:**

- Smaller initial bundle size
- Faster page load
- Code splitting per route

## Lazy Subtrees

While `component` lazy loading splits just the view component, `subtree` allows you to lazy load an entire branch of your route configuration.

### Usage

1. Define the subtree in a separate file using `defineRoute`:

```tsx
// routes/admin.ts
import { defineRoute, lazy } from 'retend/router';

export default defineRoute({
  path: '/admin', // Must match the parent route path
  component: lazy(() => import('./AdminLayout')),
  children: [
    { path: 'dashboard', component: lazy(() => import('./AdminDashboard')) },
    { path: 'users', component: lazy(() => import('./AdminUsers')) },
  ],
});
```

2. Import it using `subtree` and `lazy` in your main router:

```tsx
// router.ts
import { Router, lazy } from 'retend/router';

const router = new Router({
  routes: [
    {
      path: '/admin',
      subtree: lazy(() => import('./routes/admin')),
    },
  ],
});
```

**Constraints:**

- The `path` of the lazy subtree root MUST match the `path` defined in the parent router.
- Use `defineRoute` (or `defineRoutes` for an array) to ensure type safety and correct structure.

## Wildcard Routes (404s)

Use `*` to match any path (typically for 404 pages):

```tsx
const router = new Router({
  routes: [
    { path: '/', component: lazy(() => import('./pages/Home')) },
    { path: '/about', component: lazy(() => import('./pages/About')) },
    { path: '*', component: lazy(() => import('./pages/NotFound')) }, // Catches all unmatched routes
  ],
});
```

## Structure with Headless Routes

**Best Practice**: Prefer using "headless" nested routes to group related paths.

### Use Subtrees for Large Features

For complex features with many sub-routes, use `subtree` instead of defining everything in a single large routes array. This ensures only the necessary route configuration is loaded when the feature is accessed.

```tsx
// main-router.ts
{
  path: '/admin',
  subtree: lazy(() => import('./routes/admin'))
}
```

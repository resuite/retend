# Routing Reference

Retend includes a built-in file-based router with support for lazy loading, params, query strings, and nested routes.

## Basic Setup

### Router Initialization

```tsx
import { Router, lazy } from 'retend/router';

// Simple object-based route configuration
const router = new Router({
  routes: [
    { path: '/', component: () => lazy(import('./pages/Home')) },
    { path: '/about', component: () => lazy(import('./pages/About')) },
    { path: '/users/:id', component: () => lazy(import('./pages/User')) },
  ],
});
```

### Route Records (Alternative Syntax)

```tsx
import { Router, type RouteRecords } from 'retend/router';

const Home = () => <div>Home</div>;
const About = () => <div>About</div>;

const routes: RouteRecords = [
  { name: 'home', path: '/', component: Home },
  { name: 'about', path: '/about', component: About },
  {
    name: 'user',
    path: '/users/:userId',
    path: '/users/:userId',
    component: () => lazy(import('./pages/User')),
  },
];

const router = new Router({ routes });
```

**Note:** Each route needs at least `path` and `component` (or `children`). The `name` field is recommended for programmatic navigation.

## Lazy Loading

Lazy load route components for better performance:

```tsx
const router = new Router({
  routes: [
    { path: '/', component: () => lazy(import('./pages/Home')) },
    { path: '/dashboard', component: () => lazy(import('./pages/Dashboard')) },
    { path: '/profile', component: () => lazy(import('./pages/Profile')) },
  ],
});
```

**Benefits:**

- Smaller initial bundle size
- Faster page load

- Code splitting per route

## Lazy Subtrees

While `component` lazy loading splits just the view component, `subtree` allows you to lazy load an entire branch of your route configuration. This is ideal for large features (like an Admin section) that have many child routes.

### Usage

1. Define the subtree in a separate file using `defineRoute`:

```tsx
// routes/admin.ts
import { defineRoute, lazy } from 'retend/router';

export default defineRoute({
  path: '/admin', // Must match the parent route path
  component: () => lazy(import('./AdminLayout')),
  children: [
    { path: 'dashboard', component: () => lazy(import('./AdminDashboard')) },
    { path: 'users', component: () => lazy(import('./AdminUsers')) },
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

## Dynamic Routes (Params)

### Defining Params

Use `:` prefix to define URL parameters:

```tsx
const router = new Router({
  routes: [
    { path: '/users/:userId', component: () => lazy(import('./pages/User')) },
    {
      path: '/posts/:postId/comments/:commentId',
      component: () => lazy(import('./pages/Comment')),
    },
  ],
});
```

### Accessing Params

Use `useCurrentRoute()` hook to access route parameters:

```tsx
import { useCurrentRoute } from 'retend/router';
import { Cell } from 'retend';

function UserProfile() {
  const route = useCurrentRoute(); // Cell<RouteData>
  const userId = Cell.derived(() => route.get().params.get('userId'));

  return (
    <div>
      <h1>User Profile</h1>
      <p>User ID: {userId}</p>
    </div>
  );
}
```

### Multiple Params

```tsx
import { useCurrentRoute } from 'retend/router';
import { Cell } from 'retend';

function CommentPage() {
  const route = useCurrentRoute();
  const postId = Cell.derived(() => route.get().params.get('postId'));
  const commentId = Cell.derived(() => route.get().params.get('commentId'));

  return (
    <div>
      <p>Post: {postId}</p>
      <p>Comment: {commentId}</p>
    </div>
  );
}
```

## Query Parameters

### Reading Query Params

Use `useRouteQuery()` hook for reactive access to query parameters:

```tsx
import { useRouteQuery } from 'retend/router';
import { Cell } from 'retend';

function SearchPage() {
  const query = useRouteQuery();
  const searchTerm = query.get('q'); // Cell<string | null>

  return (
    <div>
      <p>Searching for: {searchTerm}</p>
    </div>
  );
}

// URL: /search?q=retend
// Displays: "Searching for: retend"
```

### Checking if Query Param Exists

```tsx
import { useRouteQuery } from 'retend/router';
import { If } from 'retend';

function FilterStatus() {
  const query = useRouteQuery();
  const hasFilter = query.has('filter'); // Cell<boolean>

  return If(hasFilter, () => <p>Filter is active</p>);
}
```

### Setting Query Params

```tsx
import { useRouteQuery } from 'retend/router';

function SortControl() {
  const query = useRouteQuery();

  const setSort = async (sortBy: string) => {
    await query.set('sort', sortBy); // Triggers navigation
  };

  return (
    <>
      <button onClick={() => setSort('name')}>Sort by Name</button>
      <button onClick={() => setSort('date')}>Sort by Date</button>
    </>
  );
}
```

### Multi-Value Query Params

```tsx
import { useRouteQuery } from 'retend/router';
import { For } from 'retend';

function TagFilters() {
  const query = useRouteQuery();

  // Get all values for a key
  const tags = query.getAll('tags'); // Cell<string[]>

  // Add a tag (allows multiple 'tags' params)
  const addTag = async (tag: string) => {
    await query.append('tags', tag);
  };

  return (
    <div>
      <ul>
        {For(tags, (tag) => (
          <li>{tag}</li>
        ))}
      </ul>
      <button onClick={() => addTag('react')}>Add React Tag</button>
    </div>
  );
}

// URL: /items?tags=red&tags=blue
// Renders: "red", "blue"
```

### Removing Query Params

```tsx
import { useRouteQuery } from 'retend/router';

function QueryManager() {
  const query = useRouteQuery();

  const removeFilter = async () => {
    await query.delete('filter'); // Remove specific param
  };

  const clearAll = async () => {
    await query.clear(); // Remove all query params
  };

  return (
    <>
      <button onClick={removeFilter}>Remove Filter</button>
      <button onClick={clearAll}>Clear All</button>
    </>
  );
}
```

## Navigation

### Using useRouter()

To navigate programmatically, use the `useRouter` hook:

```tsx
import { useRouter } from 'retend/router';

function Navigation() {
  const router = useRouter(); // Must be used inside RouterProvider

  const goToAbout = () => {
    router.navigate('/about');
  };

  const goToUser = (id: number) => {
    router.navigate(`/users/${id}`);
  };

  const goToSearch = () => {
    router.navigate('/search?q=retend&sort=recent');
  };

  return (
    <div>
      <button onClick={goToAbout}>About</button>
      <button onClick={() => goToUser(123)}>User 123</button>
      <button onClick={goToSearch}>Search</button>
    </div>
  );
}
```

### Replacing History

Replace the current history entry:

```tsx
import { useRouter } from 'retend/router';

function LoginRedirect() {
  const router = useRouter();

  const handleLogin = async () => {
    // ... login logic ...

    // Replace login page in history with dashboard
    router.replace('/dashboard');
  };

  return <button onClick={handleLogin}>Log In</button>;
}
```

**Difference from navigate:**

- `navigate` - Adds new entry to history (user can go back)
- `replace` - Replaces current entry (user can't go back to replaced page)

### Going Back

Navigate back in history:

```tsx
import { useRouter } from 'retend/router';

function BackButton() {
  const router = useRouter();

  return <button onClick={() => router.back()}>← Back</button>;
}
```

### Going Forward

Navigate forward in history:

```tsx
function ForwardButton() {
  return <button onClick={() => window.history.forward()}>Forward →</button>;
}
```

## Current Route

### useCurrentRoute()

Get the current route information:

```tsx
import { useCurrentRoute } from 'retend/router';
import { Cell } from 'retend';

function RouteInfo() {
  const route = useCurrentRoute(); // Cell<RouteData>

  const path = Cell.derived(() => route.get().path);
  const name = Cell.derived(() => route.get().name);

  return (
    <div>
      <p>Current Path: {path}</p>
      <p>Route Name: {name}</p>
    </div>
  );
}
```

## Nested Routes

### Parent-Child Routes

```tsx
import { Router, type RouteRecords, Outlet } from 'retend/router';

// Parent component must include <Outlet />
const Dashboard = () => (
  <div>
    <h1>Dashboard</h1>
    <nav>
      <a href="/dashboard/overview">Overview</a>
      <a href="/dashboard/stats">Stats</a>
    </nav>
    <Outlet /> {/* Child routes render here */}
  </div>
);

const Overview = () => <div>Overview Content</div>;
const Stats = () => <div>Stats Content</div>;

const routes: RouteRecords = [
  {
    name: 'dashboard',
    path: '/dashboard',
    component: Dashboard,
    children: [
      { name: 'overview', path: 'overview', component: Overview },
      { name: 'stats', path: 'stats', component: Stats },
    ],
  },
];

// Routes created: /dashboard/overview, /dashboard/stats
```

**Important:** Child paths are relative to the parent path.

### Deep Nesting

```tsx
const routes: RouteRecords = [
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      {
        path: 'users',
        component: UsersLayout,
        children: [
          { path: ':userId', component: UserDetail },
          { path: ':userId/edit', component: UserEdit },
        ],
      },
    ],
  },
];

// Creates routes:
// /admin/users/:userId
// /admin/users/:userId/edit
```

## Wildcard Routes

Use `*` to match any path (typically for 404 pages):

```tsx
const router = new Router({
  routes: [
    { path: '/', component: () => lazy(import('./pages/Home')) },
    { path: '/about', component: () => lazy(import('./pages/About')) },
    { path: '*', component: () => lazy(import('./pages/NotFound')) }, // Catches all unmatched routes
  ],
});
```

With RouteRecords:

```tsx
const routes: RouteRecords = [
  { name: 'home', path: '/', component: Home },
  { name: 'about', path: '/about', component: About },
  { name: 'not-found', path: '*', component: NotFound },
];
```

## Route Guards / Locking

### Locking Navigation

Prevent navigation away from a route using `router.lock()`:

```tsx
import { useRouter } from 'retend/router';
import { Cell, Observer } from 'retend';

function FormPage() {
  const router = useRouter();
  const hasUnsavedChanges = Cell.source(false);

  // Lock the route when there are unsaved changes
  Observer(() => {
    if (hasUnsavedChanges.get()) {
      router.lock();
    } else {
      router.unlock();
    }
  });

  // Listen for lock prevention (optional)
  Observer(() => {
    // You would need to add an event listener to the router instance
    const handler = (e) => {
      if (confirm('Discard changes?')) {
        router.unlock();
        // Retry navigation...
      }
    };
    router.addEventListener('routelockprevented', handler);
    return () => router.removeEventListener('routelockprevented', handler);
  });

  return (
    <form>
      <input onChange={() => hasUnsavedChanges.set(true)} />
      <button type="submit">Save</button>
    </form>
  );
}
```

## Link Component

Use standard `<a>` tags for navigation (router handles them automatically via window listeners), or use the `Link` component.

```tsx
import { Link } from 'retend/router';

function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/users/123">User 123</Link>
    </nav>
  );
}
```

## Complete Example

```tsx
import { Router } from 'retend/router';
import { Cell, If } from 'retend';
import { useRouter, useCurrentRoute, useRouteQuery } from 'retend/router';

// Route setup
const router = new Router({
  routes: [
    { path: '/', component: () => lazy(import('./pages/Home')) },
    { path: '/search', component: () => lazy(import('./pages/Search')) },
    {
      path: '/users/:userId',
      component: () => lazy(import('./pages/UserProfile')),
    },
    { path: '*', component: () => lazy(import('./pages/NotFound')) },
  ],
});

// Search page with query params
function SearchPage() {
  const query = useRouteQuery();
  const searchTerm = query.get('q');
  const sortBy = query.get('sort');

  const setSort = async (sort: string) => {
    await query.set('sort', sort);
  };

  return (
    <div>
      <h1>Search Results</h1>
      <p>Query: {searchTerm}</p>
      <p>Sort: {sortBy}</p>

      <button onClick={() => setSort('recent')}>Recent</button>
      <button onClick={() => setSort('popular')}>Popular</button>
    </div>
  );
}

// User profile with params
function UserProfile() {
  const router = useRouter();
  const route = useCurrentRoute();
  const userId = Cell.derived(() => route.get().params.get('userId'));

  return (
    <div>
      <h1>User Profile</h1>
      <p>Viewing user: {userId}</p>
      <button onClick={() => router.navigate('/')}>Back to Home</button>
    </div>
  );
}

// Navigation component
function Nav() {
  return (
    <nav>
      <a href="/">Home</a>
      <a href="/search?q=retend">Search</a>
      <a href="/users/123">User 123</a>
    </nav>
  );
}
```

## Best Practices

### 1. Use Lazy Loading

Always use dynamic imports for route components:

```tsx
// Good
const router = new Router({
  routes: [
    { path: '/dashboard', component: () => lazy(import('./pages/Dashboard')) },
  ],
});
```

### 2. Name Your Routes

Naming routes helps with debugging:

```tsx
const routes: RouteRecords = [
  { name: 'home', path: '/', component: Home },
  { name: 'user-profile', path: '/users/:userId', component: UserProfile },
];
```

### 3. Use Cell.derived for Params/Query

Always derive values from params and query hooks:

```tsx
// Good
const route = useCurrentRoute();
const userId = Cell.derived(() => route.get().params.get('userId'));

// Avoid (not reactive)
const userId = route.get().params.get('userId');
```

### 4. Handle 404s

Always include a wildcard route for unmatched paths:

```tsx
const router = new Router({
  routes: [
    // ...
    { path: '*', component: () => import('./pages/NotFound') },
  ],
});
```

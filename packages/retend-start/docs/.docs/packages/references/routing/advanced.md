# Advanced Routing

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
    path: '/dashboard',
    component: Dashboard,
    children: [
      { path: 'overview', component: Overview },
      { path: 'stats', component: Stats },
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

## Route Guards / Locking

### Locking Navigation

Prevent navigation away from a route using `router.lock()`:

```tsx
import { useRouter } from 'retend/router';
import { Cell, onSetup } from 'retend';

function FormPage() {
  const router = useRouter();
  const hasUnsavedChanges = Cell.source(false);

  // Lock the route when there are unsaved changes
  hasUnsavedChanges.listen((unsaved) => {
    if (unsaved) {
      router.lock();
    } else {
      router.unlock();
    }
  });

  // Listen for lock prevention (optional)
  onSetup(() => {
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

## Stack Mode Navigation

**Stack Mode** turns the router into a stack-based navigation system. This lets routes act like a stack, where each route is a unique entry that can be navigated to and from.

### Enabling Stack Mode

To enable Stack Mode, set `stackMode: true` in your router configuration:

```tsx
const router = new Router({
  routes: [...],
  stackMode: true
});
```

### Example Stack Mode Flow

```tsx
// Starting at /home
router.navigate('/photos'); // Adds /photos to the stack
router.navigate('/photos/1'); // Adds /photos/1 to the stack

// Stack is now: ['/home', '/photos', '/photos/1']

router.back(); // Pops back to /photos
// Stack is now: ['/home', '/photos']

router.navigate('/settings'); // Adds /settings to the stack
// Stack is now: ['/home', '/photos', '/settings']

router.navigate('/home'); // Pops back to /home
// Stack is now: ['/home']
```

## View Transitions

The router supports the native View Transitions API to animate navigation between routes.

To enable it, set the `useViewTransitions` property to `true` in your router configuration.

```tsx
const router = new Router({
  routes: [...],
  useViewTransitions: true
});
```

When enabled, route updates will be wrapped in `document.startViewTransition()`, allowing you to define CSS animations for the transition.

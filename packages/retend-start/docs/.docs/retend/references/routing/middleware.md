# Router Middleware

Middlewares allow you to intercept navigation, handle redirects, or perform side effects before a route is loaded.

## Middleware Setup

To use middleware, define them using `defineRouterMiddleware` and pass them to the `Router` constructor.

```tsx
import { Router, defineRouterMiddleware, redirect } from 'retend/router';

// Define a middleware
const authMiddleware = defineRouterMiddleware(({ to }) => {
  const isLoggedIn = checkUserSession();
  if (to.metadata.get('requiresAuth') && !isLoggedIn) {
    return redirect('/login');
  }
});

const router = new Router({
  routes: [...],
  middlewares: [authMiddleware]
});
```

## `defineRouterMiddleware`

Creates a type-safe middleware instance.

**Callback Arguments:**

- `from`: The `RouteData` of the current route (or null if initial load).
- `to`: The `RouteData` of the target route.

**Returns:**

- `void` or `Promise<void>`: Continue navigation.
- `RouterMiddlewareResponse` (via `redirect()`): Redirect to a new path.

## Redirects

Use the `redirect()` function within a middleware to change the navigation target.

```tsx
import { defineRouterMiddleware, redirect } from 'retend/router';

const trailingSlashMiddleware = defineRouterMiddleware(({ to }) => {
  if (to.path !== '/' && to.path.endsWith('/')) {
    return redirect(to.path.slice(0, -1));
  }
});
```

**Notes:**

- Redirects are processed sequentially.
- The router has a maximum redirect limit (default 100) to prevent infinite loops.

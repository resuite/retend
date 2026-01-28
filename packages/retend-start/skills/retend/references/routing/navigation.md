# Navigation

## Programmatic Navigation

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

### Active State

The `<Link />` component automatically applies an `active` attribute when the current route matches the link's `href`. This is reactive and updates automatically on navigation.

- **Matching Logic:** Partial match (startsWith).
  - `href="/users"` matches `/users` and `/users/123`.
  - `href="/"` matches everything (so it's always active).

```css
/* Styling the active link */
a[active] {
  font-weight: bold;
  color: blue;
}
```

## Current Route

Get the current route information:

```tsx
import { useCurrentRoute } from 'retend/router';
import { Cell } from 'retend';

function RouteInfo() {
  const route = useCurrentRoute(); // Cell<RouteData>

  const path = Cell.derived(() => route.get().path);

  return (
    <div>
      <p>Current Path: {path}</p>
    </div>
  );
}
```

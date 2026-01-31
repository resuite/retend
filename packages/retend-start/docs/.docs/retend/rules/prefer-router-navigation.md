| title                    | impact | impactDescription                                         | tags                      |
| :----------------------- | :----- | :-------------------------------------------------------- | :------------------------ |
| Prefer Router Navigation | High   | Ensures single-page application behavior and performance. | routing, performance, spa |

# Prefer Router Navigation

**Rule**:

- **NEVER** use `window.location.href`, `window.location.assign()`, or `window.history.pushState()` directly for internal navigation.
- **ALWAYS** use the `Router` instance's `navigate()` method or the `<Link />` component.

**Why**:

- **SPA Behavior**: Using `window.location` logic causes a full page reload, defeating the purpose of a Single Page Application (SPA).
- **State Preservation**: Full reloads wipe application state (Cells). Router navigation preserves state (unless explicitly reset).
- **Performance**: Full reloads are slower and require re-downloading/parsing assets.

## Examples

### Invalid

```tsx
const navigateToHome = () => {
  // Bad: Causes full page reload
  window.location.href = '/home';
};
```

### Valid

```tsx
import { useRouter } from 'retend/router';

const navigateToHome = () => {
  const router = useRouter();
  // Good: Client-side navigation
  router.navigate('/home');
};

// Or using Link
<Link href="/home">Go Home</Link>;
```

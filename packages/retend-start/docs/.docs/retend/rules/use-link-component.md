| title              | impact | impactDescription                                              | tags                              |
| :----------------- | :----- | :------------------------------------------------------------- | :-------------------------------- |
| Use Link Component | Medium | Enables client-side navigation and prevents full page reloads. | routing, navigation, optimization |

# Use Link Component

**Rule**: Use the `Link` component from `retend/router` instead of `<a>` tags for internal navigation.

**Why**:

- **Client-Side Navigation**: `Link` intercepts the click event and uses the history API to change the URL without a full page reload.
- **Active State**: `Link` automatically handles active styling based on the current route.
- **Performance**: Preserves application state that would be lost during a hard reload.

## Examples

### Invalid

```tsx
// Causes full page reload
<a href="/about">About</a>
```

### Valid

```tsx
import { Link } from 'retend/router';

// Uses client-side navigation
<Link to="/about">About</Link>;
```

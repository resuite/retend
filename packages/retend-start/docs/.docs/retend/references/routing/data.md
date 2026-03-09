# Routing Data

## Dynamic Routes (Params)

### Defining Params

Use `:` prefix to define URL parameters:

```tsx
const router = new Router({
  routes: [
    { path: '/users/:userId', component: lazy(() => import('./pages/User')) },
    {
      path: '/posts/:postId/comments/:commentId',
      component: lazy(() => import('./pages/Comment')),
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

### Best Practice: Use Cell.derived

Always derive values from params and query hooks to maintain reactivity:

```tsx
// Good
const route = useCurrentRoute();
const userId = Cell.derived(() => route.get().params.get('userId'));

// Avoid (not reactive)
const userId = route.get().params.get('userId');
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

**Note:** Query mutation methods (`set`, `append`, `delete`, `clear`) are asynchronous and return `Promise<void>`. They trigger navigation to update the URL.

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

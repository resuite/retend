| title | impact | impactDescription | tags |
| :--------------------------- | :------- | :--------------------------------------------------- | :------------------------------------ |
| Composite for Related Data | LOW | Prevents partial updates and ensures data consistency. | cells, composite, async, consistency |

# Use Cell.createComposite() only for related data

**Rule**: Only group cells that must be consistent with each other into a composite.

**Why**: `Cell.createComposite()` waits for ALL cells to settle before any value updates. Grouping unrelated cells causes unnecessary waiting.

**Invalid**:
```tsx
// BAD: Unrelated data in composite causes unnecessary waiting
const everything = Cell.createComposite({
  user: userCell,
  weather: weatherCell,     // Not related to user
  stockPrices: stocksCell   // Not related to user
});

// Weather and stocks wait for user to load, and vice versa
```

**Valid**:
```tsx
// GOOD: Only related data grouped together
const userDashboard = Cell.createComposite({
  user: userCell,
  userPosts: postsCell,           // Depends on user
  userNotifications: notificationsCell  // Depends on user
});

// Ensures user, posts, and notifications update together
// Weather and stocks can load independently elsewhere
```

**When to use Cell.createComposite()**:
- Loading related data that should display together (user + user's posts)
- Preventing UI from showing mismatched data during updates
- Grouping multiple tasks for unified loading/error states

**Accessing composite values**:
```tsx
function Dashboard() {
  const dashboard = Cell.createComposite({ user, posts });
  
  return (
    <div>
      {If(dashboard.pending, () => <LoadingSpinner />)}
      {If(dashboard.error, (err) => <ErrorMessage error={err} />)}
      {If(Cell.derived(() => !dashboard.pending.get()), () => (
        <>
          <UserProfile user={dashboard.values.user} />
          <PostList posts={dashboard.values.posts} />
        </>
      ))}
    </div>
  );
}
```

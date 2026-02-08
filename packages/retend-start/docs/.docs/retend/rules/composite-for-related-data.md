| title | impact | impactDescription | tags |
| :--------------------------- | :------- | :--------------------------------------------------- | :------------------------------------ |
| Composite for Related Data | LOW | Prevents partial updates and ensures data consistency. | cells, composite, async, consistency |

# Use Cell.composite() only for related data

**Rule**: Only group cells that must be consistent with each other into a composite.

**Why**: `Cell.composite()` waits for ALL cells to settle before any value updates. Grouping unrelated cells causes unnecessary waiting.

**Invalid**:
```tsx
// BAD: Unrelated data in composite causes unnecessary waiting
const everything = Cell.composite({
  user: userCell,
  weather: weatherCell,     // Not related to user
  stockPrices: stocksCell   // Not related to user
});

// Weather and stocks wait for user to load, and vice versa
```

**Valid**:
```tsx
// GOOD: Only related data grouped together
const userDashboard = Cell.composite({
  user: userCell,
  userPosts: postsCell,           // Depends on user
  userNotifications: notificationsCell  // Depends on user
});

// Ensures user, posts, and notifications update together
// Weather and stocks can load independently elsewhere
```

**When to use Cell.composite()**:
- Loading related data that should display together (user + user's posts)
- Preventing UI from showing mismatched data during updates
- Grouping multiple tasks for unified loading/error states

**Accessing composite values**:
```tsx
function Dashboard() {
  const dashboard = Cell.composite({ user, posts });

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

**Using `.loaded` to prevent flicker:**
```tsx
function Dashboard() {
  const dashboard = Cell.composite({ user, posts });

  return (
    <div>
      {If(dashboard.pending, () => <LoadingSpinner />)}
      {If(dashboard.error, (err) => <ErrorMessage error={err} />)}
      {If(dashboard.loaded, () => (
        <>
          {/* Content stays visible during refresh */}
          <UserProfile user={dashboard.values.user} />
          <PostList posts={dashboard.values.posts} />
        </>
      ))}
    </div>
  );
}
```

**Key difference between `.pending` and `.loaded`:**
- `.pending` - `true` while ANY cell is loading (switches on/off during refreshes)
- `.loaded` - `true` after first successful load (stays `true` even during refreshes)

Use `.loaded` when you want content to remain visible while refreshing, and `.pending` when you want to show loading states.

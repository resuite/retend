<p align="center">
    <img src="https://raw.githubusercontent.com/adebola-io/unfinished/refs/heads/main/icon.svg" width="200" alt="unfinished logo">
</p>

# unfinished

[![downloads (@adbl/unfinished)](https://img.shields.io/npm/dm/@adbl/unfinished?label=downloads)](https://www.npmjs.com/package/@adbl/unfinished)

`unfinished` is a(nother) library for web apps. It works by converting JSX straight to DOM nodes without a runtime or tracking system. The name is tongue-in-cheek.

## Table of Contents

- [unfinished](#unfinished)
  - [Table of Contents](#table-of-contents)
  - [Key Features](#key-features)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Quick Start](#quick-start)
    - [Understanding Cells.](#understanding-cells)
    - [Rendering Lists](#rendering-lists)
    - [Conditional Rendering](#conditional-rendering)
  - [Routing](#routing)
    - [Setting Up the Router](#setting-up-the-router)
    - [Implementing the Router](#implementing-the-router)
    - [Nested Routing](#nested-routing)
    - [Lazy Loading Routes](#lazy-loading-routes)
    - [Programmatic Navigation](#programmatic-navigation)
    - [Dynamic Route Parameters](#dynamic-route-parameters)
    - [Wildcard Routes](#wildcard-routes)
    - [Stack Mode Navigation](#stack-mode-navigation)
      - [Enabling Stack Mode](#enabling-stack-mode)
      - [Example Stack Mode Flow](#example-stack-mode-flow)
    - [Keep Alive Routes](#keep-alive-routes)
    - [Router Relays](#router-relays)
      - [Basic Usage](#basic-usage)
      - [Lifecycle Behavior](#lifecycle-behavior)
  - [Why This Library?](#why-this-library)
  - [License](#license)

## Key Features

- **Lightweight**: Minimal overhead for optimal performance
- **JSX Support**: Familiar syntax for React developers
- **Reactive**: Built-in reactivity with the [`@adbl/cells`](https://github.com/adebola-io/cells) library.
- **Routing**: Built-in routing system for single-page applications
- **Hot Module Replacement**: Supports hot module replacement for a seamless development experience

## Installation

To create a new project with this library, run the following command:

```bash
npx @adbl/unfinished-start
```

Follow the prompts to configure your project, then:

```bash
cd your-project-name
npm install
npm run dev
```

Open `http://localhost:5229` in your browser to see your new app!

## Usage

### Quick Start

Here's a simple example to get you started with the library:

```jsx
import { Cell } from '@adbl/cells';

const Counter = () => {
  const count = Cell.source(0);

  const increaseCount = () => {
    count.value++;
  };

  return (
    <div>
      <output>{count}</output>
      <button onClick={increaseCount}>Increment</button>
    </div>
  );
};

document.body.append(<Counter />);
```

The example above will make a simple counter component that will increment the count when the button is clicked.

### Understanding Cells.

Cells are a reactive data structure that can be used to store and update data in a reactive way. They are similar to Reactive Variables in other reactive programming libraries.

The `Cell.source` function is used to create a new cell with an initial value. The `value` property of the cell can be accessed to get or set the current value of the cell.

```jsx
import { Cell } from '@adbl/cells';

const count = Cell.source(0);

count.value++; // Increments the value of the cell by 1
```

In the example above, the `count` cell is initialized with a value of 0. The `value` property of the cell is then incremented by 1.

Crucially, within JSX templates, you use the cell object directly (without .value) to maintain reactivity:

```jsx
<div> Count: {count} </div>
```

Whenever `count.value` is modified, the UI will automatically update to reflect the new value. This reactive behavior is the foundation of how `unfinished` handles dynamic updates.

### Rendering Lists

The `For` function can be used to efficiently render lists:

```jsx
import { For } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const listItems = Cell.source([
  'Learn the library',
  'Build a web app',
  'Deploy to production',
]);

const TodoList = () => {
  return (
    <ul>
      {For(listItems, (item, index) => (
        <li>
          {item} (Index: {index})
        </li>
      ))}
    </ul>
  );
};

document.body.append(<TodoList />);

// Later, when the listItems cell updates, the DOM will be updated automatically
listItems.value.push('Celebrate success');
```

> The `For` function is aggressive when it comes to caching nodes for performance optimization.
> This means that the callback function provided to `For` **should** be pure and not rely on external state or produce side effects, because the callback function might not be called when you expect it to be.
>
> Here's an example to illustrate why this is important:
>
> ```tsx
> import { For } from '@adbl/unfinished';
> import { Cell } from '@adbl/cells';
>
> let renderCount = 0;
> const items = Cell.source([
>   { id: 1, name: 'Alice' },
>   { id: 2, name: 'Bob' },
>   { id: 3, name: 'Charlie' },
> ]);
>
> const List = () => {
>   return (
>     <ul>
>       {For(items, (item) => {
>         renderCount++; // This is problematic!
>         return (
>           <li>
>             {item.name} (Renders: {renderCount})
>           </li>
>         );
>       })}
>     </ul>
>   );
> };
>
> document.body.append(<List />);
> // Initial output:
> // - Alice (Renders: 1)
> // - Bob (Renders: 2)
> // - Charlie (Renders: 3)
>
> // Later:
> items.value.splice(1, 0, { id: 4, name: 'David' });
> // Actual output:
> // - Alice (Renders: 1)
> // - David (Renders: 4)
> // - Bob (Renders: 2)
> // - Charlie (Renders: 3)
> ```
>
> In the example, when we splice a new item into the middle of the array, the `For` function reuses the existing nodes for Alice, Bob, and Charlie. It only calls the callback function for the new item, David. This leads to an unexpected render count for David.
>
> To avoid this issue, use the reactive index provided by `For`:
>
> ```tsx
> const List = () => {
>   return (
>     <ul>
>       {For(items, (item, index) => {
>         return (
>           <li>
>             {item.name} (Index: {index})
>           </li>
>         );
>       })}
>     </ul>
>   );
> };
> ```
>
> This approach ensures correct behavior regardless of how the array is modified, as the index is always up-to-date.

### Conditional Rendering

Use the `If` function for conditional rendering:

```jsx
import { If } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const isLoggedIn = Cell.source(false);
const username = Cell.source('');

// Greeting component for logged in users
function Greeting() {
  return (
    <div>
      <h1>Welcome back, {username}!</h1>
      <button
        onClick={() => {
          isLoggedIn.value = false;
        }}
      >
        Logout
      </button>
    </div>
  );
}

// Login page component for non-logged in users
function LoginPage() {
  return (
    <div>
      <h1>Please log in</h1>
      <input
        type="text"
        placeholder="Enter username"
        onInput={(_, input) => {
          username.value = input.value;
        }}
      />
      <button
        onClick={() => {
          isLoggedIn.value = true;
        }}
      >
        Login
      </button>
    </div>
  );
}

function LoginStatus() {
  return <div>
    {If(
      // Condition: check if the user is logged in
      isLoggedIn,
      // If true, render the Greeting component
      Greeting,
      // If false, render the LoginPage component
      LoginPage
    )}
  </div>
);

// Appending the LoginStatus component to the body
document.body.append(<LoginStatus />);
```

## Routing

The library includes a routing system for single-page applications.

### Setting Up the Router

```jsx
import { createWebRouter, type RouteRecords } from '@adbl/unfinished/router';

const Home = () => {
  return <h1>Welcome to the Home Page</h1>;
};
const About = () => {
  return <h1>About Us</h1>;
};
const NotFound = () => {
  return <h1>404 - Page Not Found</h1>;
};

const routes: RouteRecords = [
  { name: 'home', path: '/', component: Home },
  { name: 'about', path: '/about', component: About },
  { name: 'not-found', path: '*', component: NotFound },
];

const router = createWebRouter({ routes });
document.body.appendChild(<router.Outlet />);
```

### Implementing the Router

Use the `useRouter` hook to access routing functionality from inside a component. This will prevents circular dependencies and import issues.

```jsx
import { useRouter } from '@adbl/unfinished/router';|

const App = () => {
  const router = useRouter();
  const { Link, Outlet } = router;

  return (
    <div class="app">
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default App;
```

### Nested Routing

The library supports nested routing for more complex application structures:

```jsx
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
```

```jsx
import { useRouter } from '@adbl/unfinished/router';

const Dashboard = () => {
  const { Link, Outlet } = useRouter();
  return (
    <div>
      <h1>Dashboard</h1>
      <nav>
        <Link href="/dashboard/overview">Overview</Link>
        <Link href="/dashboard/stats">Stats</Link>
      </nav>
      <Outlet />
    </div>
  );
};
```

### Lazy Loading Routes

Implement code splitting with lazy-loaded routes:

```javascript
const Settings = lazy(() => import('./Settings'));
```

### Programmatic Navigation

Navigate programmatically using the `navigate` method:

```jsx
const ProfileButton = () => {
  const { navigate } = useRouter();
  const goToProfile = () => {
    navigate('/profile/123');
  };

  return <button onClick={goToProfile}>View Profile</button>;
};
```

### Dynamic Route Parameters

Define and access dynamic route parameters:

```javascript
{
  name: 'profile',
  path: 'profile/:id',
  component: lazy(() => import('./Profile')),
}

const Profile = () => {
  const router = useRouter();
  const id = router.params.get('id');

  return <h1>Profile ID: {id}</h1>;
};
```

### Wildcard Routes

Handle 404 pages and other catch-all scenarios:

```javascript
{
  name: 'not-found',
  path: '*',
  component: lazy(() => import('./NotFound')),
}
```

### Stack Mode Navigation

**Stack Mode** turns the router into a stack-based navigation system. This lets routes act like a stack, where each route is a unique entry that can be navigated to and from.

#### Enabling Stack Mode

To enable Stack Mode, set `stackMode: true` in your router configuration:

```tsx
const router = createWebRouter({
  routes: [...],
  stackMode: true
});
```

#### Example Stack Mode Flow

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

### Keep Alive Routes

Keep Alive preserves the DOM nodes of route components when navigating away, maintaining them for when users return. This is particularly useful for preserving form inputs, scroll positions, or complex component states across navigation.

```tsx
// Basic keep alive outlet
<Outlet keepAlive />

// With custom cache size, defaults to 10
<Outlet
  keepAlive
  maxKeepAliveCount={20}
/>
```

When enabled, the router will:

- Cache the DOM nodes of routes when navigating away
- Restore the exact state when returning to the route
- Preserve scroll positions for both the outlet and window
- Maintain form inputs and other interactive elements

This is especially valuable for scenarios like:

- Multi-step forms where users navigate between steps
- Long scrollable lists that users frequently return to
- Complex interactive components that are expensive to reinitialize
- Search results pages that users navigate back and forth from

> **NOTE**: While useful, keep alive does consume more memory as it maintains DOM nodes in memory. Consider the `maxKeepAliveCount` parameter to limit cache size based on your application's needs.

### Router Relays

Router Relays maintain continuity of DOM elements between routes. This is useful when certain elements should persist state across route changes, ensuring the same DOM node is used rather than recreating it.

#### Basic Usage

Relays allow components to be carried over between routes without unmounting or remounting. This is particularly useful for shared elements like images, avatars, or other reusable components.

```tsx
// Define a component that will persist between routes
function Photo({ src, alt }) {
  return <img src={src} alt={alt} />;
}

// Define a relay wrapper for the component
function PhotoRelay({ src, alt }) {
  const { Relay } = useRouter();
  return <Relay id="photo-relay" source={Photo} sourceProps={{ src, alt }} />;
}

// Create relay instances in different routes
function HomeRoute() {
  return (
    <div>
      <h1>Home</h1>
      <PhotoRelay src="photo.jpg" alt="Shared photo" />
    </div>
  );
}

function DetailRoute() {
  return (
    <div>
      <h1>Detail</h1>
      <PhotoRelay src="photo.jpg" alt="Shared photo" />
    </div>
  );
}
```

In the example above, the relay ensures that the `Photo` component with the same `id` (`photo-relay`) is the same across both routes, even as the routes change.

#### Lifecycle Behavior

Relays work by matching `id` attributes between instances in the current and next route. When the route changes:

- If a relay with the same `id` exists in both the current and next route, its DOM node and state are preserved.
- If no matching relay is found in the next route, the current relay is unmounted.
- New relays in the next route are created and mounted as usual.

> **NOTE**: Relays do not handle animations or transitions. Developers can implement view transitions on their own if needed, using techniques like the native `ViewTransition` API or CSS animations in combination with relays.

## Why This Library?

This library provides a lightweight alternative to larger frameworks, offering a familiar React-like syntax with built-in routing capabilities. It's perfect for developers who want the flexibility of JSX and powerful routing without the overhead of a full framework.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

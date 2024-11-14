<p align="center">
  <svg
    width="200"
    viewBox="0 0 121 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <style>
      @keyframes blink-animation {
        50% {
          opacity: 0;
        }
      }
    </style>
    <path
      d="M-0.00164795 42.4145V38.762H25.218V42.4145H-0.00164795ZM35.9615 36.5444C33.5265 36.5444 31.6568 35.8631 30.3523 34.5007C29.0479 33.1093 28.3956 31.1381 28.3956 28.5871V15.325H33.5265V27.8044C33.5265 29.2828 33.8019 30.3264 34.3527 30.9352C34.9325 31.5439 35.9181 31.8483 37.3095 31.8483C38.1212 31.8483 38.8893 31.7468 39.614 31.5439C40.3388 31.341 41.0635 31.0511 41.7882 30.6743V15.325H46.9191V36.0226H43.1361L42.7013 34.2398C41.6287 35.0515 40.5417 35.6457 39.4401 36.0226C38.3386 36.3704 37.179 36.5444 35.9615 36.5444ZM53.9666 36.0226V15.325H57.7495L58.1843 17.1078C59.2859 16.2961 60.373 15.7164 61.4455 15.3685C62.5471 14.9917 63.7066 14.8033 64.9241 14.8033C67.3591 14.8033 69.2288 15.499 70.5333 16.8904C71.8378 18.2529 72.49 20.2096 72.49 22.7605V36.0226H67.3591V23.5432C67.3591 22.0648 67.0692 21.0212 66.4895 20.4125C65.9387 19.8037 64.9676 19.4993 63.5761 19.4993C62.7645 19.4993 61.9963 19.6008 61.2716 19.8037C60.5759 19.9776 59.8512 20.2675 59.0975 20.6734V36.0226H53.9666ZM84.8423 36.0226V19.9342H78.7983V15.325H84.8423V12.5857C84.8423 10.0057 85.567 8.03453 87.0165 6.67209C88.4948 5.30964 90.6255 4.62842 93.4083 4.62842C95.9013 4.62842 98.1914 5.19369 100.279 6.32423L98.9741 10.6725C97.4377 9.77382 95.8433 9.3245 94.191 9.3245C92.7416 9.3245 91.6691 9.65787 90.9733 10.3246C90.3066 10.9623 89.9732 11.9769 89.9732 13.3683V15.325H97.8V19.9342H89.9732V36.0226H84.8423Z"
      fill="currentColor"
    />
    <rect
      style="animation: blink-animation 1s step-end infinite"
      x="107.998"
      y="0.622589"
      width="12.28"
      height="42.8"
      fill="currentColor"
    />
  </svg>
</p>

<br/>

<h1 align="center">unfinished.</h1>

[![downloads (@adbl/unfinished)](https://img.shields.io/npm/dm/@adbl/unfinished?label=downloads)](https://www.npmjs.com/package/@adbl/unfinished)

`unfinished` is a(nother) library for building web apps with JSX. It has a router. The name is tongue-in-cheek.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Key Features](#key-features)
- [Installation](#installation)
- [Usage](#usage)
  - [Quick Start](#quick-start)
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
  - [Outlet Animations](#outlet-animations)
    - [Basic Animation Setup](#basic-animation-setup)
    - [Advanced Animation Control](#advanced-animation-control)
  - [Router Relays](#router-relays)
    - [Basic Usage](#basic-usage)
    - [Animation Options](#animation-options)
    - [Lifecycle Callbacks](#lifecycle-callbacks)
    - [How It Works](#how-it-works)
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

  return (
    <div>
      <output>{count}</output>
      <button
        onClick={() => {
          count.value++;
        }}
      >
        Increment
      </button>
    </div>
  );
};

document.body.append(<Counter />);
```

The example above will make a simple counter component that will increment the count when the button is clicked.

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
> const List = createElement({
>   tag: 'user-list',
>   render: () => {
>     return (
>       <ul>
>         {For(items, (item, index) => {
>           return (
>             <li>
>               {item.name} (Index: {index})
>             </li>
>           );
>         })}
>       </ul>
>     );
>   },
> });
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

// Component to render login status using the If function
// The If function takes three arguments: a condition, a component to render if the condition is true, and a component to render if the condition is false
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

Use the `useRouter` hook to access routing functionality from inside a component:

```jsx
import { useRouter } from '@adbl/unfinished/router';

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

const Dashboard = () => {
  const { Link, Outlet } = useRouter();
  return (
    <div>
      <h1>Dashboard</h1>
      <nav>
        <Link to="/dashboard/overview">Overview</Link>
        <Link to="/dashboard/stats">Stats</Link>
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

### Outlet Animations

Router outlets can animate route transitions using CSS animations. This provides smooth visual feedback during navigation and enhances the overall user experience.

#### Basic Animation Setup

```tsx
<Outlet
  animationOptions={{
    name: 'fade',
    duration: 300,
    easing: 'ease-in-out',
  }}
/>
```

The router will look for two CSS animations: `fade-enter` and `fade-exit` in this case. Here's a complete example:

```css
@keyframes fade-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-exit {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}
```

#### Advanced Animation Control

The router provides lifecycle hooks for fine-grained animation control:

```tsx
<router.Outlet
  animationOptions={{
    name: 'fade',
    duration: 300,
    easing: 'ease-in-out',

    // Called before enter animation starts
    onBeforeEnter: async (nodes) => {
      // Setup initial states
      return {
        // Optionally override animation options
        name: 'slide',
        duration: 500,
      };
    },

    // Called after enter animation completes
    onAfterEnter: async (nodes) => {
      // Cleanup or trigger additional effects
    },

    // Called before exit animation starts
    onBeforeExit: async (nodes) => {
      // Prepare nodes for exit
    },

    // Called after exit animation completes
    onAfterExit: async (nodes) => {
      // Cleanup or trigger additional effects
    },
  }}
/>
```

The animation system supports:

- Parallel enter/exit animations
- Dynamic animation parameters
- Custom easing functions
- Complex multi-stage animations through hooks
- Full control over timing and synchronization

When combined with Router Relays, you can create sophisticated transitions where some elements animate with the outlet while others maintain continuity across routes.

### Router Relays

Router Relays enable smooth transitions of DOM elements between different routes. They maintain element continuity across route changes by preserving and transferring nodes between matching relay instances.

#### Basic Usage

```tsx
// Define a component that will be shared between routes
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

#### Animation Options

Relays support customizable transitions between routes:

```tsx
<router.Relay
  id="photo-relay" // The id is used to match relay instances in different routes
  source={Photo} // The component to be rendered
  sourceProps={photoProps} // Props to be passed to the component
  animated={true} // Enable/disable animations
  duration={500} // Animation duration in milliseconds
  easing="ease-in-out" // CSS easing function
/>
```

#### Lifecycle Callbacks

Monitor and control relay transitions using callbacks:

```tsx
<router.Relay
  id="photo-relay"
  source={Photo}
  sourceProps={photoProps}
  onNodesReceived={(nodes) => {
    // Called when nodes are received from another route
    console.log('Nodes received:', nodes);
  }}
  onNodesSent={(nodes) => {
    // Called when nodes are sent to another route
    console.log('Nodes sent:', nodes);
  }}
/>
```

#### How It Works

1. When navigating between routes, the router looks for relays with matching IDs
2. If a match is found, the DOM nodes are transferred from the source to the destination relay
3. The router maintains element positioning and applies smooth transitions
4. If no match is found, the relay renders its source component

> **NOTE**: Relays can make your app more smooth and seamless, but they can also be a performance foot-gun. Be sure to use them judiciously and only when necessary. Consider forgoing them for performance-critical sections.

## Why This Library?

This library provides a lightweight alternative to larger frameworks, offering a familiar React-like syntax with built-in routing capabilities. It's perfect for developers who want the flexibility of JSX and powerful routing without the overhead of a full framework.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```

```

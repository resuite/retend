# Grenade

A lightweight library for building web applications with JSX.

[![downloads (@adbl/grenade)](https://img.shields.io/npm/dm/@adbl/grenade?label=downloads)](https://www.npmjs.com/package/@adbl/grenade)

## Table of Contents

- [Grenade](#grenade)
  - [Table of Contents](#table-of-contents)
  - [Key Features](#key-features)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Quick Start](#quick-start)
    - [JSX Syntax](#jsx-syntax)
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
  - [Why Grenade?](#why-grenade)
  - [License](#license)

## Key Features

- **Lightweight**: Minimal overhead for optimal performance
- **JSX Support**: Familiar syntax for React developers
- **Reactive**: Built-in reactivity with `@adbl/cells`
- **Routing**: Built-in routing system for single-page applications
- **No Build Step Required**: Can be used directly in the browser

## Installation

To create a new Grenade project, run the following command:

```bash
npx create-grenade-app
```

Follow the prompts to configure your project, then:

```bash
cd your-project-name
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to see your new Grenade app!

## Usage

### Quick Start

Here's a simple example to get you started with Grenade:

```jsx
import { createElement } from '@adbl/grenade';
import { Cell } from '@adbl/cells';

const Counter = () => {
  const count = Cell.source(0);

  return (
    <div>
      <output>{count}</output>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
};

document.body.append(<Counter />);
```

### JSX Syntax

Grenade supports JSX syntax, allowing you to write HTML-like code within your JavaScript files:

```jsx
import { createElement } from '@adbl/grenade';

const Greeting = (props) => {
  return (
    <div>
      <h1>Hello, {props.name}!</h1>
      <p>Welcome to Grenade</p>
    </div>
  );
};

document.body.append(<Greeting name="World" />);
```

### Rendering Lists

Use the `For` function to efficiently render lists:

```jsx
import { createElement, For } from '@adbl/grenade';
import { Cell } from '@adbl/cells';

const listItems = Cell.source([
  'Learn Grenade',
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

### Conditional Rendering

Use the `If` function for conditional rendering:

```jsx
import { createElement, If } from '@adbl/grenade';
import { Cell } from '@adbl/cells';

const isLoggedIn = Cell.source(false);
const username = Cell.source('');

const LoginStatus = () => (
  <div>
    {If(
      isLoggedIn,
      () => (
        <div>
          <h1>Welcome back, {username}!</h1>
          <button onClick={() => (isLoggedIn.value = false)}>Logout</button>
        </div>
      ),
      () => (
        <div>
          <h1>Please log in</h1>
          <input
            type="text"
            placeholder="Enter username"
            onInput={(e) => (username.value = e.target.value)}
          />
          <button onClick={() => (isLoggedIn.value = true)}>Login</button>
        </div>
      )
    )}
  </div>
);

document.body.append(<LoginStatus />);
```

## Routing

Grenade includes a routing system for single-page applications.

### Setting Up the Router

```jsx
import {
  createWebRouter,
  type RouteRecords,
  createElement,
} from '@adbl/grenade';

const Home = () => <h1>Welcome to the Home Page</h1>;
const About = () => <h1>About Us</h1>;
const NotFound = () => <h1>404 - Page Not Found</h1>;

const routes: RouteRecords = [
  { name: 'home', path: '/', component: Home },
  { name: 'about', path: '/about', component: About },
  { name: 'not-found', path: '*', component: NotFound },
];

const router = createWebRouter({ routes });
document.body.appendChild(<router.Outlet />);
```

### Implementing the Router

Use the `useRouter` hook to access routing functionality:

```jsx
import { createElement, useRouter } from '@adbl/grenade';

const App = () => {
  const router = useRouter();
  const { Link, Outlet } = router;

  return (
    <div class="app">
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
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

Grenade supports nested routing for complex application structures:

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
  const goToProfile = () => navigate('/profile/123');

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

## Why Grenade?

Grenade provides a lightweight alternative to larger frameworks, offering a familiar React-like syntax with built-in routing capabilities. It's perfect for developers who want the flexibility of JSX and powerful routing without the overhead of a full framework.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

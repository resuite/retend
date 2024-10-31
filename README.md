# JSX DOM elements

A lightweight library for building vanilla web applications with JSX.

[![downloads (@adbl/dom)](https://img.shields.io/npm/dm/@adbl/dom?label=downloads)](https://www.npmjs.com/package/@adbl/dom)

## Table of Contents

- [JSX DOM elements](#jsx-dom-elements)
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
  - [Why This Library?](#why-this-library)
  - [License](#license)

## Key Features

- **Lightweight**: Minimal overhead for optimal performance
- **JSX Support**: Familiar syntax for React developers
- **Reactive**: Built-in reactivity with `@adbl/cells`
- **Routing**: Built-in routing system for single-page applications

## Installation

To create a new project with this library, run the following command:

```bash
npx @adbl/scaffold
```

Follow the prompts to configure your project, then:

```bash
cd your-project-name
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to see your new app!

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

### JSX Syntax

The library supports JSX syntax, allowing you to write HTML-like code within your JavaScript files:

```jsx
const Greeting = (props) => {
  return (
    <div>
      <h1>Hello, {props.name}!</h1>
      <p>Welcome to the library</p>
    </div>
  );
};

document.body.append(<Greeting name="World" />);
```

### Rendering Lists

Use the `For` function to efficiently render lists:

```jsx
import { For } from '@adbl/dom';
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

### Conditional Rendering

Use the `If` function for conditional rendering:

```jsx
import { If } from '@adbl/dom';
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
import { createWebRouter, type RouteRecords } from '@adbl/dom/router';

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

Use the `useRouter` hook to access routing functionality:

```jsx
import { useRouter } from '@adbl/dom/router';

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

The library supports nested routing for complex application structures:

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

## Why This Library?

This library provides a lightweight alternative to larger frameworks, offering a familiar React-like syntax with built-in routing capabilities. It's perfect for developers who want the flexibility of JSX and powerful routing without the overhead of a full framework.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
    <img src="https://raw.githubusercontent.com/adebola-io/unfinished/refs/heads/new-docs/icon.svg" width="200" alt="unfinished logo">
</p>

# unfinished

[![downloads (@adbl/unfinished)](https://img.shields.io/npm/dm/@adbl/unfinished?label=downloads)](https://www.npmjs.com/package/@adbl/unfinished)

`unfinished` is a client-side library for building web apps. Like React, it allows you to use JSX to create dynamic user interfaces.

If you've worked with HTML, CSS, and JavaScript, `unfinished` should be easy to pick up. It is designed to help you build applications quickly and efficiently.

## Table of Contents

- [unfinished](#unfinished)
  - [Table of Contents](#table-of-contents)
  - [Key Features](#key-features)
  - [Installation](#installation)
  - [Core Concepts](#core-concepts)
    - [Understanding JSX](#understanding-jsx)
      - [Expressions](#expressions)
      - [Attributes](#attributes)
    - [Components](#components)
      - [Basic Component Structure](#basic-component-structure)
      - [Using Components in the DOM](#using-components-in-the-dom)
      - [Composing Components](#composing-components)
      - [Props in Components](#props-in-components)
    - [Fragments](#fragments)
    - [Reactivity with Cells](#reactivity-with-cells)
      - [Creating Cells](#creating-cells)
      - [Accessing and Updating Cells](#accessing-and-updating-cells)
      - [Derived Cells](#derived-cells)
      - [Effects](#effects)
      - [Usage in JSX](#usage-in-jsx)
  - [Conditional Rendering](#conditional-rendering)
    - [Conditional Rendering using Cells](#conditional-rendering-using-cells)
    - [Conditional Rendering with an Object](#conditional-rendering-with-an-object)
    - [Conditional Rendering without an `else`](#conditional-rendering-without-an-else)
    - [Nested Conditional Rendering](#nested-conditional-rendering)
  - [List Rendering](#list-rendering)
    - [The List of Items](#the-list-of-items)
    - [The Template Function](#the-template-function)
    - [Putting It Together: Basic List Rendering](#putting-it-together-basic-list-rendering)
    - [Reactive List Rendering](#reactive-list-rendering)
    - [Using the Index](#using-the-index)
    - [Working with Lists of Objects](#working-with-lists-of-objects)
    - [How `For` Updates](#how-for-updates)
  - [Conditional Rendering with `Switch`](#conditional-rendering-with-switch)
    - [Dynamic `Switch` Using Cells](#dynamic-switch-using-cells)
    - [Handling Complex Cases with Multiple Conditions](#handling-complex-cases-with-multiple-conditions)
    - [Using a Default Case](#using-a-default-case)
  - [Element References](#element-references)
    - [Why not `document.querySelector()`?](#why-not-documentqueryselector)
  - [Life Cycles](#life-cycles)
    - [Understanding Connection and Disconnection](#understanding-connection-and-disconnection)
    - [Executing Code on Connection](#executing-code-on-connection)
    - [Executing Code on Disconnection](#executing-code-on-disconnection)
    - [Differences From Other Frameworks](#differences-from-other-frameworks)
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

## Key Features

Here's a breakdown of the core functionalities:

- **Lightweight:** `unfinished` has a small footprint, which means it loads quickly without extra overhead.

- **JSX Support:** You can use JSX to define your user interfaces. This allows you embed HTML-like structures directly into JavaScript.

- **Built-in Reactivity:** `@adbl/cells` is used for reactivity. This means that parts of your UI that depend on data will automatically update, without the need for manual triggering or rerenders.

- **Components are DOM Elements:** Components in `unfinished` are just standard DOM nodes. There is no extra layer. This gives you a high level of control and interoperability with existing DOM APIs.

- **Built-in Router:** The library includes its own router, which makes it easier to build single-page applications. The router handles navigation between parts of your app without full page reloads.

- **(Experimental) Hot Module Reload Support:** `unfinished` supports hot module reloads, which allow you to see changes instantly without refreshing the page. This speeds up development by letting you focus more on your application.

## Installation

> `NOTE`: This section assumes you already have Node.js and npm installed on your machine. If you don't, you can download them from the official [Node.js website](https://nodejs.org/en/).

To get started with `unfinished`, you'll need to create a new project using our scaffolding tool.

This will set up the basic project structure for you. Then, you'll need to install dependencies and start the development server.

- **Create a new project:**

  Open your terminal in your documents directory, and run the following command:

  ```bash
  npx @adbl/unfinished-start
  ```

  This command will prompt you for some details about your project (such as the name, if you want to use Tailwind etc.) and will generate the necessary project files.

- **Navigate to your project directory:**

  After creating the project, navigate into the project by using `cd` and the name you used:

  ```shell
  cd your-project-name
  ```

- **Install dependencies:**

  Run the following command to install all the required packages for your project:

  ```bash
  npm install
  ```

- **Start the development server:**

  Finally, start the development server using this command in the same directory:

  ```bash
  npm run dev
  ```

  This command will start a local development server, and you'll be able to see your application at `http://localhost:5229` in your browser.

## Core Concepts

### Understanding JSX

> If you are already familiar with JSX, you can skip this section and go straight to the [next one](#reactivity-with-cells).

`unfinished`, like React, Solid, and many others, allows you to write UI _components_ in a syntax called JSX. JSX is a syntax extension for JavaScript that allows you to write HTML-like code within your JavaScript files. e.g.

```jsx
const greeting = <div>Hello, world!</div>;
```

This code creates a `div` element with the text "Hello, world!" and assigns it to the `greeting` variable. It is the exact same as:

```javascript
const greeting = document.createElement('div');
greeting.textContent = 'Hello, world!';
```

#### Expressions

Possibly the most important reason JSX exists is to allow you to embed JavaScript expressions within your markup. This means you can dynamically generate content based on your application's state or props. For example:

```jsx
const name = 'John';
const greeting = <h1>Hello, {name}!</h1>;
```

In this example, the value of `name` is embedded within the JSX using curly braces `{}`. This allows the `greeting` element to dynamically display "Hello, John!".

You can also use JavaScript expressions to conditionally render elements. For example:

```jsx
const isLoggedIn = true;
const message = isLoggedIn ? <p>Welcome back!</p> : <p>Please log in.</p>;
```

Here, the `message` element will display "Welcome back!" if `isLoggedIn` is `true`, and "Please log in." if `isLoggedIn` is `false`.

Expressions in JSX can be any valid JavaScript expression, including function calls, mathematical operations, and more. This makes JSX a powerful tool for building dynamic user interfaces.

#### Attributes

Like in HTML, you can add attributes to JSX elements. For example, you can add a class to a heading:

```jsx
<h1 class="my-heading">Hello, world!</h1>

<input type="text" />

<button type="submit" id="submit-btn">
```

_However_, in `unfinished`, there are some slight differences to HTML attributes to better support the use of JavaScript expressions.

- For listener attributes, e.g. `onclick`, `oninput`, `onmouseover` etc., the jsx equivalent is named in camelCase, e.g. `onClick`, `onInput`, `onMouseOver` etc.
  Let's say you want to add a click event listener to a button. In HTML, you would write:

  ```html
  <button onclick="alert('Hello, world!')">Click me!</button>
  ```

  In JSX, you would write:

  ```jsx
  function sayHello() {
    alert('Hello, world!');
  }

  const button = <button onClick={sayHello}>Click me!</button>;
  ```

- The `style` attribute can accept text, like in HTML, _however_ it can also accepts a JavaScript object, which would contain the CSS properties (in camelCase) and their values. For example:

  ```jsx
  <div
    style={{
      backgroundColor: 'red',
      fontSize: '20px',
    }}
  >
    Hello, world!
  </div>
  ```

This will render a div with a red background color and a font size of 20 pixels. It is the exact same as:

```html
<div style="background-color: red; font-size: 20px;">Hello, world!</div>
```

---

### Components

In `unfinished`, components are the building blocks of your application, allowing you to encapsulate and reuse pieces of your UI.

#### Basic Component Structure

A component in `unfinished` is a function that returns JSX, which is then converted into DOM nodes. Here's a simple example:

```jsx
function MyComponent() {
  return <h1>This is my component!</h1>;
}
```

This function returns a JSX element, which is then rendered as a DOM node. The equivalent vanilla JavaScript would be:

```javascript
function MyComponent() {
  const h1 = document.createElement('h1');
  h1.textContent = 'This is my component!';
  return h1;
}
```

#### Using Components in the DOM

Because the JSX returned by a component is a DOM node, you can append it to any other element in the DOM. For example:

```jsx
document.body.append(<MyComponent />);
```

This is equivalent to:

```javascript
document.body.appendChild(MyComponent());
```

#### Composing Components

Your UI is composed by combining multiple components together. For example, you can create a component that renders a heading and a paragraph:

```jsx
function Heading() {
  return <h1>Hello, world!</h1>;
}

function Paragraph() {
  return <p id="my-paragraph">This is a paragraph.</p>;
}

function MyComponent() {
  return (
    <div>
      <Heading />
      <Paragraph />
      <span>This is a span.</span>
    </div>
  );
}
```

In this example, `Heading` and `Paragraph` are combined into `MyComponent`, creating a larger, reusable component. The equivalent vanilla JavaScript would be:

```javascript
function Heading() {
  const h1 = document.createElement('h1');
  h1.textContent = 'Hello, world!';
  return h1;
}

function Paragraph() {
  const p = document.createElement('p');
  p.textContent = 'This is a paragraph.';
  p.setAttribute('id', 'my-paragraph');
  return p;
}

function MyComponent() {
  const div = document.createElement('div');
  div.appendChild(Heading());
  div.appendChild(Paragraph());
  const span = document.createElement('span');
  span.textContent = 'This is a span.';
  div.appendChild(span);
  return div;
}
```

#### Props in Components

Components can accept arguments, known as "props", which allow you to pass data into them. This makes components more flexible and reusable. Here's an example:

```jsx
function Greeting(props) {
  return <h1>Hello, {props.name}!</h1>;
}

function App() {
  return (
    <div>
      <Greeting name="Alice" />
      <Greeting name="Bob" />
    </div>
  );
}
```

In this example, the `Greeting` component accepts a `name` prop and uses it to display a personalized greeting. The equivalent vanilla JavaScript would be:

```javascript
function Greeting(props) {
  const h1 = document.createElement('h1');
  h1.textContent = `Hello, ${props.name}!`;
  return h1;
}

function App() {
  const div = document.createElement('div');
  div.appendChild(Greeting({ name: 'Alice' }));
  div.appendChild(Greeting({ name: 'Bob' }));
  return div;
}
```

### Fragments

In JSX, components must return a single root element. This can sometimes be inconvenient if you want to return multiple adjacent elements without a container. This is where fragments come in.

Fragments let you group multiple JSX elements without an extra node to the DOM. They are written using empty JSX tags: `<></>`.

For example, if you wanted to return two paragraphs from a component, you might be tempted to do this:

```jsx
// ❌ Don't do this!
function MyComponent() {
    return (
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
    );
}
```

This will result in an error, as JSX expects a single root element. To fix this, you can wrap the paragraphs in a fragment:

```jsx
function MyComponent() {
  return (
    <>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    </>
  );
}
```

This will render the two paragraphs as siblings in the DOM, without adding an extra wrapping `div` or other element.

### Reactivity with Cells

In `unfinished`, data that changes over time is managed using a "cell". A `Cell` is a container that holds data and automatically triggers updates when that data changes. If you know about reactive signals or `refs` in other frameworks, cells work similarly.

Cells are provided by the [`@adbl/cells`](https://github.com/adebola-io/cells) library, which means they can be used outside `unfinished`.

#### Creating Cells

Cells are created using the `Cell.source(...)` method. For example:

```javascript
import { Cell } from '@adbl/cells';

// Cell with value 0
const number = Cell.source(0);

// Cell with value "Hello"
const message = Cell.source('Hello');

// Cell with an array of fruits.
const fruits = Cell.source(['Apple', 'Pawpaw', 'Orange']);

// Cell with a user object.
const user = Cell.source({ id: 0, name: 'John Doe' });
```

#### Accessing and Updating Cells

To get the value of a Cell, or to update it, you interact with its `value` property. Whenever the `value` property is changed, `unfinished` will automatically update the parts of your UI that use that cell.

```javascript
number.value++; // Increments the value of the count cell
message.value = 'Goodbye!'; // Changes the value of the message cell
```

#### Derived Cells

It is also possible to have cells that depend on the value of other cells. These readonly, "derived" cells are transformations or reflections of their "source" cells, so they will automatically change when the cells they depend on change.

```javascript
// Cell with value 3.
const count = Cell.source(3);

// Cell with value 3 * 2 = 6, depends on count.
const doubledCount = Cell.derived(() => count.value * 2);

// When the value of count changes, the function passed in will rerun and automatically recompute the value of doubledCount.
count.value = 5;
console.log(doubledCount.value); // has automatically changed to 5 * 2 = 10.

count.value = 10;
console.log(doubledCount.value); // has automatically changed to 10 * 2 = 20.
```

You can have derived cells that depend on more than one source cell:

```javascript
count a = Cell.source(1);
const b = Cell.source(2);

// Cell with value 1 + 2 = 3
const sum = Cell.derived(() => a.value + b.value);

a.value = 5;
console.log(sum.value);
// Because a has changed, sum will automatically change to 5 + 2 = 7.

b.value = 3;
console.log(b.value);
// Because b has also changed, sum will automatically change to 5 + 3 = 8.
```

And also derived cells that depend on other derived cells.

```javascript
const age = Cell.source(20);

const isAdult = Cell.derived(() => age.value > 18);
const canDrive = Cell.derived(() => isAdult.value);
```

> `NOTE`: Derived cells are constant mirrors of their dependencies, so you cannot change their values directly. For example:
>
> ```javascript
> const name = Cell.source('Adebola');
> const greeting = Cell.derived(() => `Hello, ${name.value}!`);
>
> // The line below will lead to an error!
> greeting.value = 'Hello, Uche!';
> ```
>
> This is because the flow of data in cells in unidirectional (from sources -> derivations). This will become more important to remember as you build more complex user interfaces.

#### Effects

An effect is a function that runs where the cell is updated. It is useful for performing side effects, such as logging or updating other cells. You can use the `listen` method to add an effect to a cell:

```javascript
const count = Cell.source(0);
count.listen((value) => {
  console.log(`The count is now ${value}`);
});
```

You can also use the `runAndListen` method, which will run the effect once, and then add it to the list of effects for the cell:

```javascript
const count = Cell.source(0);
count.runAndListen((value) => {
  // This will be logged once when the program first runs,
  // and then it will be logged again whenever count
  // changes.
  console.log(`The count is now ${value}`);
});
```

#### Usage in JSX

To maintain reactivity, the cell object can be used within JSX expressions, (note: not the `.value` property). This triggers the automatic updates when the value is changed:

```jsx
const Counter = () => {
  const count = Cell.source(0);
  const increaseCount = () => {
    count.value++;
  };

  return (
    <div>
      <output>The count is: {count}</output>
      <button type="button" onClick={increaseCount}>
        Increase Count
      </button>
    </div>
  );
};
```

To learn more about how the cell system works, check out the [Cells documentation](https://github.com/adebola-io/cells).

## Conditional Rendering

The `If` function in `unfinished` lets you show or remove parts of your user interface based on a true or false condition. This is very useful for creating things like loading indicators, showing different content based on whether a user is logged in, or displaying error messages.

It takes up to three arguments:

1. **A condition** that will be evaluated as true or false.
   This value can also be a Cell object, and the `If` component will automatically update if the value changes.
2. **A template function for truthy values**, which will be called if the condition is evaluated to be true.
3. **An optional template function for falsy values** that will be called if the condition is evaluated to be false.

- **Basic Conditional Rendering:**

In this example, we'll have a boolean variable to control whether or not to display a welcome message.

```jsx
import { If } from '@adbl/unfinished';

const loggedIn = true;

const AuthenticatedGreeting = () => {
  const LoggedInGreeting = () => <h1>Welcome Back!</h1>;
  const NotLoggedInPrompt = () => <p>Please Log in.</p>;

  return <div>{If(loggedIn, LoggedInGreeting, NotLoggedInPrompt)}</div>;
};

document.body.append(<AuthenticatedGreeting />);
```

If the `isLoggedIn` value is `true`, a `<h1>Welcome back!</h1>` element will be displayed on the page. If the value was `false`, a `<p>Please log in.</p>` element would be displayed.

### Conditional Rendering using Cells

When you want to respond to changes dynamically, you can use `Cell` objects to control the `If` component.

```jsx
import { Cell } from '@adbl/cells';
import { If } from '@adbl/unfinished';

const loggedIn = Cell.source(false); // Initialized to false.

const AuthenticatedGreeting = () => {
  const LoggedInGreeting = () => <h1>Welcome Back!</h1>;
  const NotLoggedInPrompt = () => <p>Please Log in.</p>;

  const toggleLoginState = () => {
    isLoggedIn.value = !isLoggedIn.value;
  };

  return (
    <div>
      {If(isLoggedIn, LoggedInGreeting, NotLoggedInPrompt)}
      <button onClick={toggleLoginState}>Toggle Log in</button>
    </div>
  );
};
```

In the example above, we've added a button to change the state of the UI. The `AuthenticatedGreeting` component starts by displaying that a user is not logged in. When the `button` is clicked, `isLoggedIn` will change, and the `If` component will automatically update.

### Conditional Rendering with an Object

You can also pass an object as the second argument to the `If` component. This object is expected to have `true` property and `false` properties which are both functions. This can often be more ergonomic than passing two functions directly as the second and third parameters, especially when there is a need to nest the conditions.

```jsx
import { Cell } from '@adbl/cells';
import { If } from '@adbl/unfinished';

const isLoggedIn = Cell.source(false);

const AuthenticatedGreeting = () => {
  const LoggedInGreeting = () => <h1>Welcome Back!</h1>;
  const NotLoggedInPrompt = () => <p>Please Log in.</p>;

  const toggleLoginState = () => {
    isLoggedIn.value = !isLoggedIn.value;
  };

  return (
    <div>
      {If(isLoggedIn, {
        true: LoggedInGreeting,
        false: NotLoggedInPrompt,
      })}
      <button onClick={toggleLoginState}>Toggle Log in</button>
    </div>
  );
};
```

### Conditional Rendering without an `else`

If you don't need to render anything when the condition is false, simply omit the `second` function.

```jsx
import { If } from '@adbl/unfinished';

const isLoading = true;

const LoadingMessage = () => {
  const LoadingText = () => <div>Loading...</div>;
  return (
    <div>
      {If(isLoading, LoadingText)}
      {/* If not loading, nothing will be displayed. */}
    </div>
  );
};
```

In the example above, the `LoadingMessage` component will show "Loading..." when `isLoading` is `true`. Otherwise, nothing is displayed.

### Nested Conditional Rendering

In `unfinished`, you can nest `If` components to create more complex conditional rendering logic. This is useful when you have multiple conditions to check and want to render different components based on those conditions.

Here's an example of how to implement nested conditional rendering:

```jsx
import { Cell } from '@adbl/cells';
import { If } from '@adbl/unfinished';

const userStatus = Cell.source('guest'); // Initialized to 'guest'.
const userIsAdmin = Cell.derived(() => userStatus.value === 'admin');

const UserGreeting = () => {
  const AdminGreeting = () => <h1>Welcome, Admin!</h1>;
  const UserGreeting = () => <h1>Welcome, User!</h1>;
  const GuestGreeting = () => <h1>Welcome, Guest!</h1>;

  return (
    <div>
      {If(userStatus, {
        true: () =>
          If(userIsAdmin, {
            true: AdminGreeting,
            false: UserGreeting,
          }),
        false: GuestGreeting,
      })}
    </div>
  );
};

// Example of toggling user status
const toggleUserStatus = () => {
  userStatus.value = userStatus.value === 'guest' ? 'user' : 'guest';
};

// Example of setting user status to admin
const setAdminStatus = () => {
  userStatus.value = 'admin';
};
```

In this example, the `UserGreeting` component checks the value of `userStatus`. If the user is an admin, it renders the `AdminGreeting` component. If the user is a regular user, it renders the `UserGreeting` component. If the user is a guest, it renders the `GuestGreeting` component.

You can also toggle the user status using the `toggleUserStatus` function, which switches between 'guest' and 'user', or set the user status to 'admin' using the `setAdminStatus` function.

## List Rendering

In many web applications, you'll need to display lists of items. Think of a to-do list, a list of products, or a list of user comments. `unfinished` provides a special function called `For` to handle these scenarios efficiently. It lets you create these lists dynamically, updating the webpage whenever the data changes.

If you are already familiar with JavaScript `for` loops or array's `map` method, `For` does something similar, but it does it in a way that is integrated directly with the structure of your web page, updating it automatically.

The `For` function takes two key pieces of information:

- **The list itself:** This is the collection of data you want to display. It can be a regular JavaScript array or a special reactive container called a `Cell` that we explained earlier.
- **A "template" function:** This is a function that determines how each item in the list should be displayed on the page. It receives each individual item in your list and its index, and tells `unfinished` what HTML structure should be created for it.

Here's a breakdown of each of these aspects, along with examples to help you understand them:

### The List of Items

The `For` function can handle two kinds of list: regular JavaScript arrays and special `Cell` objects that are made available through the `@adbl/cells` library.

- **Regular JavaScript Arrays**: If your list is static (doesn't change) then you can use a normal array like this:

  ```javascript
  const items = ['Apple', 'Banana', 'Orange'];
  ```

- **`Cell` Objects (for Dynamic Lists)**: If the list you need to display can change over time, perhaps because of user interaction or incoming data, it needs to be wrapped in a `Cell` object, using the `Cell.source()` method:

  ```javascript
  import { Cell } from '@adbl/cells';
  const items = Cell.source([
    'Learn the library',
    'Build a web app',
    'Deploy to production',
  ]);
  ```

  The `@adbl/cells` library will notify `For` anytime the items in your list changes, and `For` will automatically make the same changes to your user interface without you having to tell it to.

### The Template Function

The "template" function you give to `For` is a regular JavaScript function that returns JSX elements. Think of it as a blueprint for how each item in the list should be displayed. It takes the following:

- `item`: This is each individual value from your list. E.g., the string "Apple", a user object, etc.
- `index`: A special `Cell` object, that contains the current index (starting from 0) of the element you're currently processing. For example:
  - If "Apple" is the first item in the array, the `index` cell's value will be 0.
  - If "Orange" is the third element in your array, then the `index` cell will have a value of 2.

This is what a template function looks like:

```javascript
(item, index) => {
  return (
    <li>
      {item}, at index: {index.value}
    </li>
  );
};
```

### Putting It Together: Basic List Rendering

Here’s how you might display a list of strings using `For`:

```jsx
import { For } from '@adbl/unfinished';

const items = ['Apple', 'Banana', 'Orange'];

const FruitList = () => {
  return (
    <ul>
      {For(items, (item) => (
        <li>{item}</li>
      ))}
    </ul>
  );
};

document.body.append(<FruitList />);
```

The result in your web browser is a basic unordered list displaying "Apple", "Banana", and "Orange" as list items.

### Reactive List Rendering

If you want your list to update dynamically, then you can use a `Cell`:

```jsx
import { For } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const items = Cell.source([
  'Learn the library',
  'Build a web app',
  'Deploy to production',
]);

const TodoList = () => {
  return (
    <ul>
      {For(items, (item) => (
        <li>{item}</li>
      ))}
    </ul>
  );
};

document.body.append(<TodoList />);

// Later, when the listItems cell updates, the DOM will be updated automatically
items.value.push('Celebrate success');
```

With this code, the webpage now keeps the to-do list up-to-date by responding to changes in the `items` cell and re-rendering the list as needed.

### Using the Index

The `For` function provides a second argument to your template function, a cell containing the _index_ of the current item:

```jsx
import { For } from '@adbl/unfinished';

const items = ['First', 'Second', 'Third'];

const NumberedList = () => {
  return (
    <ul>
      {For(items, (item, index) => (
        <li>
          {item} (Index: {index})
        </li>
      ))}
    </ul>
  );
};

document.body.append(<NumberedList />);
```

With the `index`, you can add extra information (e.g., the item number) next to your item in the page. Note how the index is used without `.value` to preserve reactivity.

### Working with Lists of Objects

`For` can also be used to display information from objects:

```jsx
import { For } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const users = Cell.source([
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
]);

const UserList = () => {
  return (
    <ul>
      {For(users, (user) => (
        <li>
          {user.name} is {user.age} years old.
        </li>
      ))}
    </ul>
  );
};

document.body.append(<UserList />);
```

With this code, you're extracting information (name and age) from user objects and displaying them inside your web page.

### How `For` Updates

When you change something in a list wrapped by `For`, instead of tearing down and recreating the list from scratch, it tries to do updates efficiently:

- **Auto-Memoization:** When it encounters the same data in a list for a second time, `For` automatically recognizes it, and instead of re-rendering the entire associated DOM nodes from scratch, it reuses the previous DOM nodes and only changes its index.
- **Pure template Functions** The function that determines how each item should be rendered should not change based on things outside the function's input. In fact, your callback function might not even run if the item was memoized from a previous call.

The `For` function provides a smart, performant and reactive method for displaying and handling lists. By focusing on its use of the template function, how to handle different list types and how to interpret reactivity, you can render lists effectively in `unfinished`.

## Conditional Rendering with `Switch`

The `Switch` function allows you to choose between a number of possible UI options based on a given value.

```jsx
import { Switch } from '@adbl/unfinished';

const userType = 'premium';

const UserTypeDisplay = () => {
  return (
    <div>
      {Switch(userType, {
        free: () => <p>Free user, features are limited.</p>,
        basic: () => <p>Basic User</p>,
        premium: () => <p>Premium user with more features.</p>,
        enterprise: () => <p>Enterprise user, please contact admin.</p>,
      })}
    </div>
  );
};

document.body.append(<UserTypeDisplay />);
```

In this example, `Switch` looks at the `userType` variable, and depending on its value, it shows the corresponding html on screen. This illustrates a way of rendering content conditionally by using a static JavaScript variable.

### Dynamic `Switch` Using Cells

If the value you want to switch on can change over time, you can make use of the reactivity system with the help of `Cells`.

Here is an example showing a navigation system that has some basic routing built into it:

```jsx
import { Switch } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const currentView = Cell.source('home');

const goHome = () => {
  currentView.value = 'home';
};

const goSettings = () => {
  currentView.value = 'settings';
};

const goProfile = () => {
  currentView.value = 'profile';
};

const NavigationView = () => {
  return (
    <div>
      <nav>
        <button onClick={goHome}>Home</button>
        <button onClick={goSettings}>Settings</button>
        <button onClick={goProfile}>Profile</button>
      </nav>
      <main>
        {Switch(currentView, {
          home: () => (
            <section>
              <h1>Welcome to the Home Screen!</h1>
            </section>
          ),
          profile: () => (
            <section>
              <h1>Here is your profile.</h1>
            </section>
          ),
          settings: () => (
            <section>
              <h1>Settings for your Account</h1>
            </section>
          ),
        })}
      </main>
    </div>
  );
};

document.body.append(<NavigationView />);
```

In this code snippet, when each button is clicked, the corresponding section is shown on screen by modifying the value of the `currentView` Cell, the changes are automatically propagated to the browser to create a dynamic web application.

### Handling Complex Cases with Multiple Conditions

`Switch` also shines in situations where you need to consider more complex conditions, for example if you need to apply multiple states to a component at the same time:

```jsx
import { Switch } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const isLoggedIn = Cell.source(false);
const isAdmin = Cell.source(false);

const UserDashboard = () => {
  const logUserOut = () => {
    isLoggedIn.value = false;
    isAdmin.value = false;
  };

  const logUserIn = () => {
    isLoggedIn.value = true;
    isAdmin.value = false;
  };

  const logAdminIn = () => {
    isLoggedIn.value = true;
    isAdmin.value = true;
  };

  const getUserType = () => {
    if (!isLoggedIn.value) return 'guest';
    return isAdmin.value ? 'admin' : 'user';
  };
  return (
    <div>
      <button onClick={logUserIn}>Log in</button>
      <button onClick={logAdminIn}>Log in as Admin</button>
      <button onClick={logUserOut}>Log out</button>

      {Switch(Cell.derived(getUserType), {
        guest: () => <h1>Please log in.</h1>,
        admin: () => <h1>Welcome back, Administrator!</h1>,
        user: () => <h1>Welcome back!</h1>,
      })}
    </div>
  );
};

document.body.append(<UserDashboard />);
```

### Using a Default Case

The optional third argument of `Switch` takes a function that receives the current value of the `Switch` variable and can be used to create a fallback if it does not match any specific cases.

```jsx
import { Switch } from '@adbl/unfinished';
import { Cell } from '@adbl/cells';

const userRole = Cell.source('editor');

const UserDashboard = () => {
  const setRole = (role) => {
    userRole.value = role;
  };
  return (
    <div>
      <button onClick={() => setRole('editor')}>Set Editor</button>
      <button onClick={() => setRole('admin')}>Set Admin</button>
      <button onClick={() => setRole('guest')}>Set Guest</button>
      {Switch(
        userRole,
        {
          admin: () => <h1>Admin Dashboard</h1>,
          editor: () => <h2>Editor Tools</h2>,
        },
        (role) => (
          <p>Unrecognized Role: {role}</p>
        )
      )}
    </div>
  );
};

document.body.append(<UserDashboard />);
```

Here we demonstrated a switch component using named "roles". This illustrates a use-case where, sometimes, the content may be unexpected, for instance, because a user may change their saved settings. This fallback allows a "catch-all" solution.

## Element References

A "ref" is fundamentally a pointer to a specific element that was created using JSX. It is basically an identifier or a named bookmark for an element that exists on the page. With a ref you create a JavaScript variable that actually holds your HTML element and allows you to interact with it.

It allows other code, usually within the functions that render your view, to communicate, observe, and directly modify actual existing parts of the page, without needing to rely on indirect methods of finding or re-constructing elements manually.

In `unfinished`, using refs involves these key parts:

- **Creating a Reactive `Cell`:** First, you need to create a `Cell` where the reference will be stored at a later time.

```javascript
import { Cell } from '@adbl/cells';

const elementRef = Cell.source(null);
```

Here, `elementRef` will hold the references to the node we're trying to access later on. Initially, it starts with a value of `null`, which means that there's no associated element at the beginning, but that will change.

- **Linking with the `ref` Attribute:** In your JSX, you use the special `ref` attribute on the HTML element you want to access. You set the `Cell` variable as the attribute's value.

```jsx
<div ref={elementRef}>Hello world!</div>
```

Now when the `div` element is created, it will be assigned to the `elementRef` cell.

- **Accessing the Element:**

```jsx
import { Cell } from '@adbl/cells';

const elementRef = Cell.source(null); // elementRef.value is null
const div = <div ref={elementRef}>Hello world!</div>;
elementRef.value === div; // elementRef.value is now the div element
```

### Why not `document.querySelector()`?

While you could use `document.querySelector()` to get an HTML element directly, refs offer a more straightforward and reliable way of handling your UI interactions, specially in a reactive web app where the webpage may update and change a lot, unlike traditional apps that change less often:

- **Direct Connection:** With refs, you're creating a direct link to your HTML element in your JSX code, so it is much more reliable and predictable than having to query for it by id or classes, for instance, where those attributes may change over time with edits.
- **Reacts to Node Changes**: The `Cell` object of refs are reactive, so when used in conjunction with `useObserver` or other related patterns, can be used to react whenever a related Node disappears or becomes available again.
- **Better Code Structure**: Using refs often keeps the logic local to your component code instead of relying on a global selector-based lookup, making your code easier to read and maintain.

## Life Cycles

The only lifecycle mechanism in `unfinished` is the `useObserver()` function, which provides a way to trigger code based on the _connection_ and _disconnection_ of DOM nodes. It lets you directly respond when an element (represented by a ref) becomes available in the live Document Object Model (DOM), and again when that same node is removed.

### Understanding Connection and Disconnection

- **Connection:** A node is "connected" when it becomes part of the browser's live DOM tree. This means the node has been inserted into the document. Importantly, this is _not_ about visibility, or appearance in the viewport, but about being included in the document's structure, even if it's hidden by CSS.

- **Disconnection:** A node is "disconnected" when it is removed from the DOM tree. This happens when you remove or replace the element directly from Javascript, or when a parent of that node gets removed from the DOM.

The `useObserver()` function returns a `DocumentObserver` object, which is a wrapper around the browser's `MutationObserver` API. Its main method, `onConnected`, allows you to run a callback function when a node is connected to the DOM.

### Executing Code on Connection

Here's how to use `useObserver` to run a setup action as a reaction to html:

```jsx
import { Cell } from '@adbl/cells';
import { useObserver } from '@adbl/unfinished';

const MyComponent = () => {
  const divRef = Cell.source(null);
  const observer = useObserver();

  observer.onConnected(divRef, (element) => {
    console.log('This HTML element has connected:', element);
    element.setAttribute('data-connected', 'true');
  });

  return <div ref={divRef}>Hello World</div>;
};

document.body.append(<MyComponent />);
```

In this code:

1. We've created a ref using `const divRef = Cell.source(null)`.
2. When the `div` appears in the DOM, the callback function is automatically run.It logs a message to the console and adds a `data-connected` attribute to the element.

### Executing Code on Disconnection

The `onConnected` method also has a mechanism for cleanup logic, which gets automatically executed once the element leaves the DOM:

```jsx
import { Cell } from '@adbl/cells';
import { useObserver } from '@adbl/unfinished';

const MyComponent = () => {
  const divRef = Cell.source(null);
  const observer = useObserver();

  observer.onConnected(divRef, (element) => {
    element.setAttribute('data-connected', 'true');

    // here we return a cleanup function that runs automatically on disconnection
    return () => {
      console.log('This element has disconnected!', element);
      // Do some other stuff like clear timers.
    };
  });

  return <div ref={divRef}>Hello World</div>;
};

document.body.append(<MyComponent />);
```

In this example, the `onConnected` hook now:

1. Takes an action that runs immediately as soon as the element is present: Setting a `data-connected` attribute.
2. It returns a function. That function is stored and **only called** whenever the element gets removed.
   This makes it useful for clean up actions and prevents unexpected behavior.

### Differences From Other Frameworks

- **Node-Centric**: `useObserver` focuses directly on the HTML nodes as they exist in the DOM (the underlying tree of a webpage). It does _not_ work with abstract component representations, or artificial life-cycles, but with HTML nodes directly.
- **Explicit Timing**: The timing of "connection" and "disconnection" is very clear and predictable, based on the browser's native APIs: the action will always run at those exact phases.

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

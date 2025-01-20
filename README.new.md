<p align="center">
    <img src="https://raw.githubusercontent.com/adebola-io/unfinished/refs/heads/new-docs/icon.svg" width="200" alt="unfinished logo">
</p>

# unfinished

[![downloads (@adbl/unfinished)](https://img.shields.io/npm/dm/@adbl/unfinished?label=downloads)](https://www.npmjs.com/package/@adbl/unfinished)

`unfinished` is a purely client-side library for building modern web applications. Like React, it allows you to use a familiar HTML-like syntax with JavaScript (JSX) to create dynamic user interfaces.

If you've worked with HTML, CSS, and JavaScript, `unfinished` should be easy to pick up, and it's designed to help you build applications quickly and efficiently.

## Key Features

Here's a breakdown of the core functionalities:

- **Lightweight and Performant:** `unfinished` has a small footprint, which means it loads quickly and doesn't bog down your application with extra overhead.

- **JSX Support:** You can use JSX syntax, which might already be familiar if you've worked with React, to define your user interfaces. This allows you to embed HTML-like structures directly in your JavaScript code.

- **Built-in Reactivity (`@adbl/cells`):** The library utilizes `@adbl/cells` for its reactivity system. This means that when your data changes, the parts of your UI that depend on that data will automatically update, so you do not have to manually trigger these changes.

- **Components are DOM Elements:** Components in `unfinished` are standard DOM elements that you can manipulate just like any other HTML element. This gives you a high level of control and interoperability with existing DOM APIs.

- **Built-in Router:** The library includes its own router, which makes it easier to build single-page applications (SPAs). The router handles navigation between different parts of your app without full page reloads.

- **Hot Module Replacement (HMR) Support:** During development, HMR allows you to see your changes almost instantly without refreshing the page. This speeds up your development process by letting you focus more on your application.

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

`unfinished`, like React, Solid, and many other frameworks, allows you to write UI _components_ in a syntax called JSX. JSX is a syntax extension for JavaScript that allows you to write HTML-like code within your JavaScript files.

JSX looks similar to HTML, but it is embedded directly in your JavaScript code. This means that you can use JSX to define your UI components, and then render them on the page as regular DOM nodes. e.g.

```jsx
const greeting = <div>Hello, world!</div>;
```

This code creates a `div` element with the text "Hello, world!" and assigns it to the `greeting` variable. It is the exact same as:

```javascript
const greeting = document.createElement('div');
greeting.textContent = 'Hello, world!';
```

The JSX syntax is designed to be familiar to HTML developers, so you can use it to define your UI in a familiar way.

#### Expressions

Possibly the most important reason JSX exists is to allow you to embed JavaScript expressions within your markup. This means you can dynamically generate content based on your application's state or props. For example:

```jsx
const name = 'John';
const greeting = <h1>Hello, {name}!</h1>;
```

In this example, the value of the `name` variable is embedded within the JSX using curly braces `{}`. This allows the `greeting` element to dynamically display "Hello, John!".

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

#### Components

In `unfinished`, components are simply functions that return DOM nodes.

```jsx
function MyComponent() {
  return <h1>This is my component!</h1>;
}

// is the exact same as:

function MyComponent() {
  const h1 = document.createElement('h1');
  h1.textContent = 'This is my component!';
  return h1;
}
```

Because the JSX returned by a component is a DOM node, you can append it to any other element in the DOM.

```jsx
document.body.append(<MyComponent />);

// is the same as:

document.body.appendChild(MyComponent());
```

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

> You can note from the above, that functions that return JSX start with a capital letter. This is because JSX is case-sensitive: HTML tags are all lowercase, and component tags need to start with a capital letter.

In this example, `Heading` and `Paragraph` are combined into `MyComponent`, creating a larger, reusable component. The equivalent vanilla JavaScript would be:

```javascript
function Heading() {
  const h1 = document.createElement('h1');
  h1.textContent = 'Hello, world!';
  return h1;
}

function Paragraph(props) {
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

#### Fragments

In JSX, components must return a single root element. This can sometimes be inconvenient when you want to return multiple adjacent elements without adding an extra DOM node. This is where fragments come in.

Fragments let you group multiple JSX elements without adding an extra node to the DOM. They are written using empty JSX tags: `<></>`.

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

In `unfinished`, data that changes over time is managed using a data structure called a "cell". A `Cell` is basically a container that holds data and automatically updates your UI when that data changes. If you know about reactive signals or refs in other frameworks, cells work similarly.

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

It is also possible to have cells that depend on the value of other cells. These readonly, "derived" cells can be seen as transformations or reflections of the original "source" cell, and they will automatically change when the cell they depend on changes.

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

## Conditional Rendering with `If`

The `If` function in `unfinished` lets you render or hide parts of your user interface based on a true or false condition. This is very useful for creating things like loading indicators, showing different content based on whether a user is logged in, or displaying error messages.

The `If` function takes up to three arguments:

1. **A condition:** a value that will be evaluated as true or false.
   This value can also be a Cell object, and the `If` component will automatically update if the value changes.
2. **A render function for truthy values**: a function that will be called if the condition is evaluated to be true.
3. **An optional render function for falsy values**: a function that will be called if the condition is evaluated to be false.

Here are a few examples of how you could use the `If` function in `unfinished`:

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
```

If the `isLoggedIn` value is `true`, a `<h1>Welcome back!</h1>` element will be displayed on the page. If the value was `false`, a `<p>Please log in.</p>` element would be displayed.

### Conditional Rendering using a Cell

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

In the example above, we've added a button to change the state of the UI. The `AuthenticatedGreeting` component starts by displaying that a user is not logged in. When the `button` is clicked, the value of the `isLoggedIn` will change, and the `If` component will automatically update.

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

## Rendering Lists with `For`

In many web applications, you'll need to display lists of items. Think of a to-do list, a list of products, or a list of user comments. `unfinished` provides a special function called `For` to handle these scenarios efficiently. It lets you create these lists dynamically, updating the webpage whenever the data changes.

If you are already familiar with JavaScript `for` loops or array's `map` method, `For` does something similar, but it does it in a way that is integrated directly with the structure of your web page, updating it automatically.

The `For` function takes two key pieces of information:

- **The list itself:** This is the collection of data you want to display. It can be a regular JavaScript array or a special reactive container called a `Cell` that we explained earlier.
- **A "template" function:** This is a function that determines how each item in the list should be displayed on the page. It receives each individual item in your list and its index, and tells `unfinished` what HTML structure should be created for it.

Here's a breakdown of each of these aspects, along with examples to help you understand them:

### 1. The List of Items

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

### 2. The Template Function

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

This code does the following:

1. It defines a regular JavaScript array named `items`.
2. It uses `For(items, ...)` to go through each element in the array.
3. For each element, it uses a small `(item) => <li>{item}</li>` function to make the html that displays it as a list item inside a `<ul>` element.
4. It appends the created html element to the document body.

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

Sometimes, you need to show different content based on the value of a variable. Think of a user interface that changes based on whether a user is logged in, a section of your app that behaves differently depending on a user's selected option, or perhaps you need to choose different UI based on what a user has previously configured in settings. `unfinished` provides the `Switch` function to handle such scenarios cleanly and efficiently.

The `Switch` function is designed to make handling conditional rendering in your application easier. It allows you to choose between a number of possible UI options based on a given value.

Here's how `Switch` works:

1. **The Value to Check:** You provide a value (which can be static or dynamic in the form of a `Cell`) to `Switch`. This is the variable that will determine which content is shown.
2. **The Cases:** You define an object where the keys represent potential values for the switch condition, and their corresponding values are the functions that output the relevant parts of your UI.
3. **The Default Case (Optional):** You can also include a function to render a default UI when the value doesn't match any of the specified cases. This works like the `default` case in a JavaScript `switch` statement.

### Basic `Switch` Usage

Let's explore how to make use of switch with a few examples:

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

In this example, `Switch` looks at the `userType` variable, and depending on its value, it shows the corresponding html on screen. This illustrates a way of rendering content conditionally by using a static JavaScript variable. This allows you to build your applications with different kinds of user accounts easily.

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

In this example, `Switch` helps you render an entirely new user interface depending on multiple factors at the same time, whether the user is logged in and whether the user is also an admin, each different case displays a different output and keeps things modular and tidy. Note how the logic was extracted into a separate helper function.

### Using a Default Case

If you want to handle cases where the input value doesn't match any specified cases, use the optional "default" argument of `Switch`. The third argument of `Switch` takes a function that receives the current value of the `Switch` variable and can be used to create a fallback if it does not match any specific cases.

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

### Why Use `Switch`?

`Switch` offers a number of benefits:

- **Clear Conditional Logic:** Instead of writing long and potentially confusing `if/else` blocks, `Switch` allows you to make clear statements about UI based on an associated variable, or state in the form of a Cell.
- **Readability:** It makes it easier to understand the different states and UI combinations your code can display by following a more semantic structure.
- **Automatic Updates:** When combined with Cells it makes sure that whenever there is a change, your UI also reflects it.

## Core Concepts

### Understanding JSX

> If you are already familiar with JSX, you can skip this section and go straight to the [next one](#reactivity-with-cells).

Retend, like React, Solid, and many others, allows you to write UI _components_ in a syntax called JSX. JSX is a syntax extension for JavaScript that allows you to write HTML-like code within your JavaScript files. e.g.

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

_However_, in Retend, there are some slight differences to HTML attributes to better support the use of JavaScript expressions.

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

In Retend, components are the building blocks of your application, allowing you to encapsulate and reuse pieces of your UI.

#### Basic Component Structure

A component in Retend is a function that returns JSX, which is then converted into DOM nodes. Here's a simple example:

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

In Retend, data that changes over time is managed using a "cell". A `Cell` is a container that holds data and automatically triggers updates when that data changes. If you know about reactive signals or `refs` in other frameworks, cells work similarly.

Cells are provided by the [`@adbl/cells`](https://github.com/adebola-io/cells) library, which means they can be used outside Retend.

#### Creating Cells

Cells are created using the `Cell.source(...)` method. For example:

```javascript
import { Cell } from 'retend';

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

To get the value of a Cell, or to update it, you interact with its `value` property. Whenever the `value` property is changed, Retend will automatically update the parts of your UI that use that cell.

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
const a = Cell.source(1);
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

The `If` function in Retend lets you show or remove parts of your user interface based on a true or false condition. This is very useful for creating things like loading indicators, showing different content based on whether a user is logged in, or displaying error messages.

It takes up to three arguments:

1. **A condition** that will be evaluated as true or false.
   This value can also be a Cell object, and the `If` component will automatically update if the value changes.
2. **A template function for truthy values**, which will be called if the condition is evaluated to be true.
3. **An optional template function for falsy values** that will be called if the condition is evaluated to be false.

- **Basic Conditional Rendering:**

In this example, we'll have a boolean variable to control whether or not to display a welcome message.

```jsx
import { If } from 'retend';

const isLoggedIn = true;

const AuthenticatedGreeting = () => {
  const LoggedInGreeting = () => <h1>Welcome Back!</h1>;
  const NotLoggedInPrompt = () => <p>Please Log in.</p>;

  return <div>{If(isLoggedIn, LoggedInGreeting, NotLoggedInPrompt)}</div>;
};

document.body.append(<AuthenticatedGreeting />);
```

If the `isLoggedIn` value is `true`, a `<h1>Welcome back!</h1>` element will be displayed on the page. If the value was `false`, a `<p>Please log in.</p>` element would be displayed.

### Conditional Rendering using Cells

When you want to respond to changes dynamically, you can use `Cell` objects to control the `If` component.

```jsx
import { Cell, If } from 'retend';

const isLoggedIn = Cell.source(false); // Initialized to false.

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
import { Cell, If } from 'retend';

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
import { If } from 'retend';

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

In Retend, you can nest `If` components to create more complex conditional rendering logic. This is useful when you have multiple conditions to check and want to render different components based on those conditions.

Here's an example of how to implement nested conditional rendering:

```jsx
import { Cell, If } from 'retend';

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

In many web applications, you'll need to display lists, whether it's a to-do list, a list of products, or a list of user comments. Retend provides a special function called `For` to handle these scenarios efficiently.

If you are already familiar with JavaScript `for` loops or array's `map` method, `For` does something similar, but it does it in a way that is integrated directly with the structure of your web page, updating it automatically.

The `For` function takes two key pieces of information:

- **The list itself:** This is the collection of data you want to display. It can be a regular JavaScript array or a special reactive container called a `Cell` that we explained earlier.
- **A "template" function:** This is a function that determines how each item in the list should be displayed on the page. It receives each individual item in your list and its index, and tells Retend what HTML structure should be created for it.

Here's a breakdown of each of these aspects, along with examples to help you understand them:

### The List of Items

The `For` function can handle two kinds of list: regular JavaScript arrays and special `Cell` objects that are made available through the `@adbl/cells` library.

- **Regular JavaScript Arrays**: If your list is static (doesn't change) then you can use a normal array like this:

  ```javascript
  const items = ['Apple', 'Banana', 'Orange'];
  ```

- **`Cell` Objects (for Dynamic Lists)**: If the list you need to display can change over time, perhaps because of user interaction or incoming data, it needs to be wrapped in a `Cell` object, using the `Cell.source()` method:

  ```javascript
  import { Cell } from 'retend';
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
import { For } from 'retend';

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
import { For, Cell } from 'retend';

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
import { For } from 'retend';

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
import { For, Cell } from 'retend';

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

The `For` function provides a smart, performant and reactive method for displaying and handling lists. By focusing on its use of the template function, how to handle different list types and how to interpret reactivity, you can render lists effectively in Retend.

## Conditional Rendering with `Switch`

The `Switch` function allows you to choose between a number of possible UI options based on a given value.

```jsx
import { Switch } from 'retend';

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
import { Switch, Cell } from 'retend';

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
import { Switch, Cell } from 'retend';

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
import { Switch, Cell } from 'retend';

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

## Event Modifiers

Retend allows you to add modifiers to event listeners directly in your JSX to control how events are handled. These modifiers are inspired by similar features in other frameworks and can simplify common event-handling patterns.

Modifiers are appended to the event name using a double hyphen (`--`). For example, `onClick--prevent` will prevent the default action of a click event. You can combine multiple modifiers for complex behavior (e.g., `onSubmit--prevent--stop`).

Here are the available modifiers:

- **`self`**: Only triggers the listener if the event originates from the element itself (not from a child element).

- **`prevent`**: Calls `preventDefault()` on the event, preventing the default browser action (e.g., form submission, link navigation).

- **`once`**: The listener will only be triggered once. After the first time, it will be automatically removed.

- **`passive`**: Indicates that the listener will never call `preventDefault()`. This allows the browser to optimize scrolling performance. This is most useful for `scroll`, `touch` and `wheel` events.

- **`stop`**: Calls `stopPropagation()` on the event. This prevents the event from bubbling up to parent elements.

**Examples:**

- **Preventing Form Submission:**

```jsx
function MyForm() {
  const handleSubmit = () => {
    alert('Form submitted, but default prevented!');
  };
  return (
    <form onSubmit--prevent={handleSubmit}>
      <button type="submit">Submit</button>
    </form>
  );
}
document.body.append(<MyForm />);
```

Here, the `prevent` modifier will call `event.preventDefault()` before `handleSubmit` is called, ensuring that the browser does not perform a full-page reload when the button is clicked.

- **Stopping Event Bubbling:**

```jsx
function ParentComponent() {
  const handleParentClick = () => {
    alert('Parent clicked');
  };
  return (
    <div onClick={handleParentClick}>
      <ChildComponent />
    </div>
  );
}

function ChildComponent() {
  const handleChildClick = () => {
    alert('Child clicked');
  };

  return <button onClick--stop={handleChildClick}>Click Child</button>;
}

document.body.append(<ParentComponent />);
```

In this example, clicking the button will only trigger the `handleChildClick`, because `onClick--stop` prevents the event from propagating to the `ParentComponent`.

- **`self` modifier**:

```jsx
function MyComponent() {
  const handleDivClick = (event) => {
    alert('Div click triggered');
  };

  const handleChildClick = (event) => {
    alert('Child click triggered');
  };

  return (
    <div onClick--self={handleDivClick}>
      <button onClick={handleChildClick}>Click me!</button>
    </div>
  );
}
document.body.append(<MyComponent />);
```

In this example, clicking on the button will trigger the alert on the button's click handler, but it will not trigger the parent's click handler. Only clicking directly on the div itself will trigger the div's click handler.

- **`once` modifier**:

```jsx
import { Cell } from 'retend';

function MyComponent() {
  const clickCount = Cell.source(0);
  const handleClick = () => {
    clickCount.value++;
  };
  return (
    <div>
      <button onClick--once={handleClick}>Click me once!</button>
      <p>Clicks: {clickCount}</p>
    </div>
  );
}
document.body.append(<MyComponent />);
```

In this example, only the first click on the button will increase the counter, and subsequent clicks will do nothing.

- **Combining Modifiers:**

```jsx
function MyComponent() {
  const handleClick = (event) => {
    alert('Button clicked');
  };

  return (
    <form onSubmit--prevent>
      <button type="submit" onClick--stop--once={handleClick}>
        Click and submit
      </button>
    </form>
  );
}

document.body.append(<MyComponent />);
```

Using event modifiers helps streamline your event handling logic and reduces the amount of boilerplate code required to handle events.

## Element References

A `ref` is a "pointer" to any element that was created using JSX. It is basically an identifier or a named bookmark for an element that exists on the page. With a ref you create a JavaScript variable that actually holds your HTML element and allows you to interact with it.

It allows other code, usually within the functions that render your view, to communicate, observe, and directly modify actual existing parts of the page, without needing to rely on indirect methods of finding or re-constructing elements manually.

In Retend, using refs involves these key parts:

- **Creating a Reactive `Cell`:** First, you need to create a `Cell` where the reference will be stored at a later time.

```javascript
import { Cell } from 'retend';

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
import { Cell } from 'retend';

const elementRef = Cell.source(null); // elementRef.value is null
const div = <div ref={elementRef}>Hello world!</div>;
elementRef.value === div; // elementRef.value is now the div element
```

### Why not `document.querySelector()`?

While you could use `document.querySelector()` to get an HTML element directly, refs offer a more straightforward and reliable way of handling your UI interactions, specially in a reactive web app where the webpage may update and change a lot, unlike traditional apps that change less often:

- **Direct Connection:** With refs, you're creating a direct link to your HTML element in your JSX code, so it is much more reliable and predictable than having to query for it by id or classes, for instance, where those attributes may change over time with edits.
- **Reacts to Node Changes**: The ref `Cell` object are reactive, so when used in conjunction with [`useObserver`](#life-cycles) or other related patterns, can be used to react whenever a related Node disappears or becomes available again.
- **Better Code Structure**: Using refs often keeps the logic local to your component code instead of relying on a global selector-based lookup, making your code easier to read and maintain.

## Life Cycles

The only lifecycle mechanism in Retend is the `useObserver()` function. It provides a way to trigger code based on the _connection_ and _disconnection_ of DOM nodes.

### Understanding Connection and Disconnection

- **Connection:** A node is "connected" when it becomes part of the browser's live DOM tree. This means the node has been inserted into the document. Importantly, this is _not_ about visibility, or appearance in the viewport, but about being included in the document's structure, even if it's hidden by CSS.

- **Disconnection:** A node is "disconnected" when it is removed from the DOM tree. This happens when you remove or replace the element directly from Javascript, or when a parent of that node gets removed from the DOM.

The `useObserver()` function returns a `DocumentObserver` object, which is a wrapper around the browser's `MutationObserver` API. Its main method, `onConnected`, allows you to run a callback function when a node is connected to the DOM.

### Executing Code on Connection

Here's how to use `useObserver` to run a setup action as a reaction to html:

```jsx
import { Cell, useObserver } from 'retend';

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
import { Cell, useObserver } from 'retend';

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
import { createWebRouter, type RouteRecords } from 'retend/router';

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
import { useRouter } from 'retend/router';

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
import { useRouter } from 'retend/router';

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

### Accessing the Current Route

The `getCurrentRoute()` method on the router returns a `Cell` object that contains information about the current route. It can be used to:

- Displaying the active route's name or path
- Implementing dynamic UI based on the current route (e.g. showing breadcrumbs)
- Adjusting styles or behaviors based on the current route parameters.

**Basic Usage:**

```jsx
import { useRouter } from 'retend/router';
import { Cell } from 'retend';

function CurrentRouteDisplay() {
  const router = useRouter();
  const currentRoute = router.getCurrentRoute();

  return (
    <div>
      <h1>Current Route Details</h1>
      <p>Name: {Cell.derived(() => currentRoute.value.name)}</p>
      <p>Path: {Cell.derived(() => currentRoute.value.fullPath)}</p>
      <p>
        Parameters:{' '}
        {Cell.derived(() =>
          JSON.stringify(Object.fromEntries(currentRoute.value.params))
        )}
      </p>
      <p>Query: {Cell.derived(() => currentRoute.value.query.toString())}</p>
    </div>
  );
}
```

### Locking the Router

In certain scenarios, you might want to prevent the user from navigating away from the current route, e.g. if they have unsaved changes in a form or if a critical operation is in progress. The router provides `lock()` and `unlock()` methods for this purpose.

- **`router.lock()`**: Locks the router to the current path. Any subsequent attempts to navigate to a different path (either programmatically or via browser history) will be ignored.

- **`router.unlock()`**: Releases the lock, allowing navigation to proceed normally.

When navigation is attempted while the router is locked, the router will dispatch a `routelockprevented` event. You can listen for this event to react to blocked navigation attempts, for example, by showing a notification to the user.

**Listening for the `routelockprevented` Event:**

```javascript
import { useRouter } from 'retend/router';

const router = useRouter();

router.addEventListener('routelockprevented', (event) => {
  console.log(
    `Navigation to ${event.detail.attemptedPath} was prevented by a lock.`
  );
  // Optionally show a message to the user
  // alert('Cannot navigate away while changes are unsaved.');
});
```

**Example:**

```jsx
import { useRouter } from 'retend/router';
import { Cell } from 'retend';

function UnsavedChangesForm() {
  const router = useRouter();
  const hasUnsavedChanges = Cell.source(false);
  const saved = Cell.derived(() => !hasUnsavedChanges.value);

  const handleInput = () => {
    if (!hasUnsavedChanges.value) {
      hasUnsavedChanges.value = true;
      router.lock();
      console.log('Router locked due to unsaved changes.');
    }
  };

  const saveChanges = () => {
    // ... save logic ...
    hasUnsavedChanges.value = false;
    router.unlock();
    console.log('Changes saved, router unlocked.');
    // Optionally navigate away after saving
    // router.navigate('/some-other-page');
  };

  const discardChanges = () => {
    // ... reset form logic ...
    hasUnsavedChanges.value = false;
    router.unlock(); // Unlock navigation after discarding
    console.log('Changes discarded, router unlocked.');
  };

  return (
    <form onSubmit--prevent={(e) => e.preventDefault()}>
      <textarea
        onInput={handleInput}
        placeholder="Type something..."
      ></textarea>
      <button type="button" onClick={saveChanges} disabled={saved}>
        Save
      </button>
      <button type="button" onClick={discardChanges}>
        Discard
      </button>
      <p>
        {If(hasUnsavedChanges, {
          true: () => 'You have unsaved changes.',
          false: () => 'No unsaved changes.',
        })}
      </p>
    </form>
  );
}
```

## `useRouteQuery` Hook

The `useRouteQuery` hook provides a reactive way to access and manipulate the query parameters of the current route within your Retend application. It simplifies reading, updating, and responding to changes in the URL's query string.

### Overview

This hook returns an object containing several methods for interacting with the route's query parameters. Changes made through these methods automatically trigger route updates, ensuring your application stays in sync with the URL.

### Usage

```jsx
import { useRouteQuery } from 'retend/router';

function MyComponent() {
  const query = useRouteQuery();

  // Returns a Cell that checks if a 'search' parameter exists
  const hasSearch = query.has('search');

  // Returns a Cell containing the value of the 'search' parameter
  const searchValue = query.get('search');

  // Function to set the 'sort' parameter
  const setSort = (value) => {
    query.set('sort', value);
  };

  // Function to add a filter parameter
  const addFilter = (filterValue) => {
    query.append('filter', filterValue);
  };

  // Reactive display of the search value
  return (
    <div>
      <p>Has search parameter: {hasSearch}</p>
      <p>Search value: {searchValue}</p>
      <button onClick={() => setSort('name')}>Sort by Name</button>
      <button onClick={() => addFilter('category1')}>
        Add Category 1 Filter
      </button>
    </div>
  );
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

> **NOTE**: Relays do not handle animations or transitions. Developers can implement view transitions on their own if needed, using techniques like the native `ViewTransition` API or CSS animations in combination with relays.
> View transitions can be turned on by setting the `useViewTransitions` property of the router to `true`.

## Advanced Components

Retend provides several advanced components that can help you build complex UIs. Here's a breakdown of the most useful ones:

### Teleport

The `Teleport` component allows you to move a part of your component's content to a different location in the DOM, outside of its natural parent. This is extremely useful for creating modals, tooltips, or elements that should appear at a specific place in the document, regardless of the component's position in your application's structure.

Let's imagine a simple use case: a navigation bar that is rendered at the top of the page, and a modal that needs to be rendered outside of the navigation bar, directly as a child of the `body` element.

- **Basic Example**:

```jsx
import { Teleport } from 'retend/teleport';

function NavBar() {
  return (
    <nav>
      <h1>My Application</h1>
      <Teleport to={document.body}>
        <div style={{ backgroundColor: 'lightgray', padding: '20px' }}>
          This content is outside the nav bar.
        </div>
      </Teleport>
    </nav>
  );
}

document.body.append(<NavBar />);
```

In the example above, the `div` will be rendered as a child of the `body` element, even though it is defined inside the `NavBar` component.

- **More complex example**:

```jsx
import { If, Cell } from 'retend';
import { Teleport } from 'retend/teleport';

function Modal({ content, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '20px',
        border: '1px solid black',
      }}
    >
      <button onClick={onClose}>close</button>
      {content}
    </div>
  );
}

function NavBar() {
  const showModal = Cell.source(false);

  return (
    <nav>
      <h1>My Application</h1>
      <button onClick={() => (showModal.value = true)}>Open Modal</button>

      {If(showModal, () => (
        <Teleport to={document.body}>
          <Modal
            content={<p>This is a modal outside the nav bar.</p>}
            onClose={() => (showModal.value = false)}
          />
        </Teleport>
      ))}
    </nav>
  );
}

document.body.append(<NavBar />);
```

In this example, `Teleport` is used to render the `Modal` component directly under the `body` tag. This simplifies modal positioning without needing complex CSS workarounds for the nav bar structure.

- **Using a CSS selector**:

```jsx
import { Teleport } from 'retend/teleport';

function MyComponent() {
  return (
    <div>
      <Teleport to="#portal-target">
        <div>This is rendered into the #portal-target div</div>
      </Teleport>
    </div>
  );
}

document.body.append(<MyComponent />);
```

Here, `Teleport` moves the `div` into a specific element that's identified by its ID (`#portal-target`). This means you can move components to specific locations using existing structures.

### ShadowRoot

The `ShadowRoot` component allows you to encapsulate your component's styling and structure by creating a shadow DOM. The shadow DOM provides a way to build complex components while avoiding conflicts with global CSS or other parts of the DOM, which is especially useful for reusable custom components.

```jsx
import { ShadowRoot } from 'retend/shadowroot';

function MyComponent() {
  return (
    <div>
      <ShadowRoot>
        <style>
          {`
          div {
            background-color: lightgreen;
            padding: 10px;
          }
        `}
        </style>
        <div>
          <h1>Content in Shadow DOM</h1>
          <p>This content is encapsulated.</p>
        </div>
      </ShadowRoot>
    </div>
  );
}

document.body.append(<MyComponent />);
```

Here, the styling inside `ShadowRoot` (the green background) will not leak out and will not be affected by any external CSS styles that target the `div` tag.

- **Open vs Closed Shadow DOM**:

```jsx
import { ShadowRoot } from 'retend/shadowroot';

function MyComponent() {
  return (
    <>
      <div style={{ border: '2px solid blue', padding: '10px' }}>
        <ShadowRoot mode="open">
          <div>Open Shadow DOM content</div>
        </ShadowRoot>
      </div>
      <div style={{ border: '2px solid blue', padding: '10px' }}>
        <ShadowRoot mode="closed">
          <div>Closed Shadow DOM content</div>
        </ShadowRoot>
      </div>
    </>
  );
}

document.body.append(<MyComponent />);
```

By default, shadow DOMs are `open`, meaning you can access their nodes using the `.shadowRoot` property from JavaScript. Setting `mode="closed"` makes the shadow root inaccessible from the outside, providing extra encapsulation (but not security.)

- **Using Components inside the Shadow Root**:

```jsx
import { ShadowRoot } from 'retend/shadowroot';

function StyledButton({ children, backgroundColor }) {
  return (
    <button
      style={{
        backgroundColor,
        color: 'white',
        padding: '10px',
        border: 'none',
      }}
    >
      {children}
    </button>
  );
}

function MyComponent() {
  return (
    <div style={{ border: '2px solid blue', padding: '10px' }}>
      <ShadowRoot>
        <div>
          <StyledButton backgroundColor="red">Click Me</StyledButton>
        </div>
      </ShadowRoot>
    </div>
  );
}

document.body.append(<MyComponent />);
```

As you can see, you can add components to shadow DOM just like any other component and they will inherit the encapsulation behavior of `ShadowRoot`.

- **Multiple Shadow Roots**:

```jsx
import { ShadowRoot } from 'retend/shadowroot';

function MyComponent() {
  return (
    <div>
      <ShadowRoot>
        <div>First shadow root.</div>
      </ShadowRoot>
      <ShadowRoot>
        <div>Second shadow root.</div>
      </ShadowRoot>
    </div>
  );
}

document.body.append(<MyComponent />);
```

It is possible to add multiple `ShadowRoot` components on a single parent component, but it may not lead to the most predictable behavior. Ideally, it's best to only have one `ShadowRoot` per parent, but these can be nested in different parents to get fine-grained control over the shadow DOMs.

### Include

The `Include` component allows you to include a pre-existing element from the DOM into your component. It's like creating a portal, but in reverse. Instead of moving content, you're bringing an existing DOM element into your component's structure. This can be helpful when working with existing HTML structures that you cannot easily modify, or to "inject" shared components from one part of the app to another.

- **Basic inclusion**:

```jsx
import { Include } from 'retend/include';

// Assume there is this element on the page:
// <div id="external-component">
//   <h1>I am from outside</h1>
// </div>

function MyComponent() {
  return (
    <div>
      <h1>My Component</h1>
      <Include from="#external-component" />
    </div>
  );
}

document.body.append(<MyComponent />);
```

The above code will insert the content of the `#external-component` node inside your `MyComponent`.

- **Including and modifying properties**:

```jsx
import { Include } from 'retend/include';

// Assume there is this element on the page:
// <div id="external-component" style="color: red;">
//   <p>I am from outside</p>
// </div>

function MyComponent() {
  return (
    <div>
      <h1>My Component</h1>
      <Include from="#external-component" style={{ color: 'green' }} />
    </div>
  );
}

document.body.append(<MyComponent />);
```

In this example, `Include` is used to pull in the external element, and then it changes the `style` property of the element. The existing external element will be modified in place.

- **Adding event listeners and attributes**:

```jsx
import { Include } from 'retend/include';

// Assume there is this element on the page:
// <button id="external-button">Click Me</button>

function MyComponent() {
  const handleClick = () => {
    alert('Button clicked!');
  };

  return (
    <div>
      <h1>My Component</h1>
      <Include from="#external-button" onClick={handleClick} disabled={true} />
    </div>
  );
}

document.body.append(<MyComponent />);
```

Here, `Include` is not just importing the button, but it is also adding a click listener and a `disabled` attribute to it.

- **Overwriting children**:

```jsx
import { Include } from 'retend/include';

// Assume there is this element on the page:
// <div id="external-component">
//   <p>I am from outside</p>
// </div>

function MyComponent() {
  return (
    <div>
      <h1>My Component</h1>
      <Include from="#external-component">
        <p>I am from inside!</p>
      </Include>
    </div>
  );
}

document.body.append(<MyComponent />);
```

In this case, the child element of `#external-component` (`<p>I am from outside</p>`) will be appended with the `p` element being passed as a `children` prop to the include component.

- **Using a component reference as a target**:

```jsx
import { Include } from 'retend/include';
import { Cell } from 'retend';

const divRef = Cell.source(null);

function ExternalComponent() {
  return (
    <div id="external-component" ref={divRef}>
      I am from outside
    </div>
  );
}

function MyComponent() {
  return (
    <div>
      <ExternalComponent />
      <h1>My Component</h1>
      <Include from={divRef} style={{ color: 'green' }} />
    </div>
  );
}

document.body.append(<MyComponent />);
```

In this example, instead of using a css selector, the `from` attribute takes a Cell, and its value is used as the target to inject into.

These advanced components provide unique ways to manage DOM interactions, encapsulation, and component structures.

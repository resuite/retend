# retend-web

The official web renderer for [Retend](https://github.com/adebola-io/retend).

Retend is a modern reactive framework for buildng fluid, dynamic web apps. `retend-web` provides the necessary pieces to bring Retend to the browser, including a high-performance DOM renderer and server-side rendering support.

## Features

- **DOM Renderer**: A specialized reconciler that maps Retend components directly to native DOM elements. No virtual DOM, no overhead.
- **Server-Side Rendering (SSR)**: Built-in `renderToString` for generating static HTML on the server.
- **Hot Module Replacement (HMR)**: Experimental support for instantaneous updates during development.
- **Direct DOM Access**: Components are native DOM elements, allowing seamless integration with existing web APIs.

## Installation

```bash
npm install retend-web retend
```

## Usage

### Client-side Rendering

To start using Retend on the web, you need to initialize the `DOMRenderer` and set it as the active renderer.

```jsx
import { setActiveRenderer, runPendingSetupEffects } from 'retend';
import { DOMRenderer } from 'retend-web';

// Initialize the renderer
setActiveRenderer(new DOMRenderer(window));

const App = () => {
  return (
    <div>
      <h1>Hello from Retend!</h1>
    </div>
  );
};

// Root element
const root = document.getElementById('app');
root.append(<App />);

// Run any setup effects (optional, but recommended)
runPendingSetupEffects();
```

### Server-side Rendering (SSR)

You can render your components to a string for server-side generation. Note that `renderToString` requires a `window` object (e.g., from `happy-dom` or `jsdom`).

```javascript
import { renderToString, DOMRenderer } from 'retend-web';
import { setActiveRenderer } from 'retend';

setActiveRenderer(new DOMRenderer(window));
const html = await renderToString(<App />, window);
console.log(html);
```

### Advanced Components

`retend-web` provides several advanced components specifically for the browser environment:

#### Teleport

The `Teleport` component allows you to move a part of your component's content to a different location in the DOM, outside of its natural parent. This is extremely useful for creating modals, tooltips, or elements that should appear at a specific place in the document, regardless of the component's position in your application's structure.

Let's imagine a simple use case: a navigation bar that is rendered at the top of the page, and a modal that needs to be rendered outside of the navigation bar, directly as a child of the `body` element.

- **Basic Example**:

```jsx
import { Teleport } from 'retend-web';

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
import { Teleport } from 'retend-web';

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
      <button onClick={() => showModal.set(true)}>Open Modal</button>

      {If(showModal, () => (
        <Teleport to={document.body}>
          <Modal
            content={<p>This is a modal outside the nav bar.</p>}
            onClose={() => showModal.set(false)}
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
import { Teleport } from 'retend-web';

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

#### ShadowRoot

The `ShadowRoot` component allows you to encapsulate your component's styling and structure by creating a shadow DOM. The shadow DOM provides a way to build complex components while avoiding conflicts with global CSS or other parts of the DOM, which is especially useful for reusable custom components.

```jsx
import { ShadowRoot } from 'retend-web';

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

- **Using Components inside the Shadow Root**:

```jsx
import { ShadowRoot } from 'retend-web';

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
import { ShadowRoot } from 'retend-web';

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

### Vite Plugin

`retend-web` includes a Vite plugin to enable JSX transformation and Hot Module Replacement (HMR).

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { retend } from 'retend-web/plugin';

export default defineConfig({
  plugins: [retend()],
});
```

## Documentation

For more detailed information on how to build apps with Retend, check out the [main documentation](https://github.com/adebola-io/retend/blob/main/docs/README.md).

## License

MIT

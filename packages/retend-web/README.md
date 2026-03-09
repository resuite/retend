# retend-web

The official DOM renderer for [Retend](https://github.com/resuite/retend).

`retend-web` provides the necessary glue to run Retend applications in the browser. It leverages the browser's native capabilities while providing a familiar JSX-based development experience.

## Key Features

- Components are DOM Elements: In `retend-web`, components are just functions that return standard DOM elements. Changes are applied directly to the DOM for maximum performance and interoperability.
- Teleport: Render children into a different part of the DOM tree, useful for modals, tooltips, and global overlays.
- Shadow Root Support: Easily encapsulate styles and structure using native Shadow DOM.
- Optimized DOM Operations: Efficiently handles updates, attributes, and events using specialized reconciliation.

## Installation

```bash
npm install retend retend-web
```

## Usage

For most apps, use `renderToDOM`:

```javascript
import { renderToDOM } from 'retend-web';

const App = () => <h1>Hello, Retend</h1>;
const root = document.getElementById('app');

renderToDOM(root, App);
```

If you need lower-level control, `retend-web` also exports `DOMRenderer`.

## Features

### Teleport

The `<Teleport />` component allows you to render its children into a specific DOM element outside of the current component hierarchy.

```jsx
import { Teleport } from 'retend-web';

const MyModal = () => (
  <Teleport to="body">
    <div class="modal">
      <h1>Hello from the teleported modal!</h1>
    </div>
  </Teleport>
);
```

### ShadowRoot

The `<ShadowRoot />` component allows you to attach a shadow root to a parent element.

```jsx
import { ShadowRoot } from 'retend-web';

const MyComponent = () => (
  <div class="host">
    <ShadowRoot>
      <style>{`.text { color: red; }`}</style>
      <span class="text">I am in the shadow DOM!</span>
    </ShadowRoot>
  </div>
);

// Note: ShadowRoot always uses open mode; `mode` is not supported.
```

## License

MIT

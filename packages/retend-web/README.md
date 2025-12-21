# retend-web

The official DOM renderer for [Retend](https://github.com/adebola-io/retend).

`retend-web` provides the necessary glue to run Retend applications in the browser. It leverages the browser's native capabilities while providing a familiar JSX-based development experience.

## Key Features

- **Components are DOM Elements:** In `retend-web`, components are just functions that return standard DOM elements.
  - There is no Virtual DOM.
  - There is no "re-render" cycle.
  - Changes are applied directly to the DOM for maximum performance and interoperability.
- **Teleport:** Render children into a different part of the DOM tree, useful for modals, tooltips, and global overlays.
- **Shadow Root Support:** Easily encapsulate styles and structure using native Shadow DOM.
- **Optimized DOM Operations:** Efficiently handles updates, attributes, and events using a specialized reconciliation engine.

## Installation

```bash
npm install retend retend-web
```

## Usage

To start using `retend-web`, you need to set the active renderer:

```javascript
import { setActiveRenderer } from 'retend';
import { DomRenderer } from 'retend-web';

const renderer = new DomRenderer(document.body);
setActiveRenderer(renderer);
```

## Features

### Teleport

The `<Teleport />` component allows you to render its children into a specific DOM element outside of the current component hierarchy.

```jsx
import { Teleport } from 'retend-web';

const MyModal = () => (
  <Teleport to={document.body}>
    <div class="modal">
      <h1>Hello from the teleported modal!</h1>
    </div>
  </Teleport>
);
```

### ShadowRoot

The `<Shadowroot />` component allows you to attach a shadow root to a parent element.

```jsx
import { Shadowroot } from 'retend-web';

const MyComponent = () => (
  <div class="host">
    <Shadowroot mode="open">
      <style>{`.text { color: red; }`}</style>
      <span class="text">I am in the shadow DOM!</span>
    </Shadowroot>
  </div>
);
```

## License

MIT

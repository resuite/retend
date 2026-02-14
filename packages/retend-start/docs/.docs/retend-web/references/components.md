# Web Components

`retend-web` provides specialized components for DOM manipulation that are not available in the core `retend` package.

## Teleport

The `<Teleport />` component allows you to render its children into a specific DOM element outside of the current component hierarchy. Useful for modals, tooltips, and global overlays.

### Usage

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

**Props:**

- `to`: `string` - A selector for the target DOM element (e.g., `"body"` for `<body>` or `"#my-id"` for an element with id="my-id").

## ShadowRoot

The `<Shadowroot />` component allows you to attach a shadow root to a parent element, enabling style and DOM encapsulation using the native Web Component Shadow DOM API.

### Usage

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

**Props:**

- `mode`: `'open' | 'closed'` - Sets the encapsulation mode (starts with 'open' by default).

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

The `<ShadowRoot />` component allows you to attach a shadow root to a parent element, enabling style and DOM encapsulation using the native Web Component Shadow DOM API.

### Usage

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
```

**Props:**

- No custom props. Use standard element attributes on the host element.

**Note:** ShadowRoot always uses `open` mode. The `mode` prop is not supported.

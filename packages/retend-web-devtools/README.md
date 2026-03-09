# retend-web-devtools

DevTools overlay for [Retend](https://github.com/resuite/retend) web applications.

Provides an in-app overlay to inspect your application's component tree, view props, and highlight rendered UI regions.

## Features

- **Component Inspector:** View the full hierarchical component tree of your application.
- **Props Viewer:** Inspect the live props passed to any component in the tree.
- **DOM Highlighting:** Hover over components in the devtools tree to highlight their corresponding DOM elements on the page.
- **Component Search:** Quickly find specific components by name within complex trees.
- **Customizable Interface:** Select highlight colors to customize the inspector.

## Installation

Install the devtools as a development dependency:

```bash
npm install -D retend-web-devtools
```

## Usage

To use the devtools, you need to wrap your application root with the `<RetendDevTools>` component.

`retend-web-devtools` automatically enables the full devtools build in development and resolves to a no-op component in production.

### Client-Side Rendered (CSR) Apps

Import and use it normally:

```tsx
import { renderToDOM } from 'retend-web';
import { RetendDevTools } from 'retend-web-devtools';
import App from './App';

const root = document.getElementById('app')!;

renderToDOM(root, () => (
  <RetendDevTools>
    <App />
  </RetendDevTools>
));
```

### Server-Side Rendered (SSR) / Hydration

If you are using `retend-server` with `hydrate`, use the `wrap` option:

```tsx
import { hydrate } from 'retend-server/client';
import { createRouter } from './router';
import { RetendDevTools } from 'retend-web-devtools';

hydrate(createRouter, {
  rootId: 'app',
  wrap(root) {
    return <RetendDevTools>{root}</RetendDevTools>;
  },
});
```

## License

MIT

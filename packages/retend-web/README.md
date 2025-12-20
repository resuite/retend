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

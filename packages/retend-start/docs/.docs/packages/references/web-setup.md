# Setup Retend Web

To render a Retend application in a web environment, you need to configure the active renderer.

## Basic Setup

In your entry file (e.g., `index.js` or `main.js`), import `setActiveRenderer` and `runPendingSetupEffects` from `retend` and `DOMRenderer` from `retend-web`.

```javascript
import { runPendingSetupEffects, setActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';

// Initialize the renderer with the window object
const renderer = new DOMRenderer(window);

// Set it as the active renderer for the framework
setActiveRenderer(renderer);
```

## Mounting Components

Once the renderer is set, render your app and append the returned nodes to the DOM.

```jsx
import { App } from './App';

const root = renderer.render(<App />);
document.body.append(...(Array.isArray(root) ? root : [root]));
runPendingSetupEffects();
```

## Source Reference

- `packages/retend-web/source/dom-renderer.js`
- `packages/retend/source/library/renderer.js`

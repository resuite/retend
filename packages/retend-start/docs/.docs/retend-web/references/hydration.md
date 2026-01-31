# Hydration

Retend supports hydration of server-rendered HTML (SSR) to make it interactive on the client.

## Enabling Hydration

To enable hydration, call the `enableHydrationMode()` method on your renderer instance _before_ running your application logic.

```javascript
import { setActiveRenderer } from 'retend';
import { DomRenderer } from 'retend-web';

const renderer = new DomRenderer(document.body);
setActiveRenderer(renderer);

// Enable hydration mode
renderer.enableHydrationMode();

// Start your app...
import { App } from './App';
// In hydration mode, this will attempt to match existing DOM nodes
// derived from server-rendered markup instead of creating new ones.
document.body.append(<App />);
```

## How it works

When hydration mode is enabled:

1.  The renderer scans the DOM for elements with `data-dyn` attributes (markers for dynamic content).
2.  It builds a hydration table mapping these markers to actual DOM nodes.
3.  When components execute, instead of creating new DOM nodes, they claim existing nodes from this table.
4.  Event listeners and reactivity are attached to the existing nodes.
5.  Once hydration is complete, the renderer switches back to normal DOM creation mode for any future updates.

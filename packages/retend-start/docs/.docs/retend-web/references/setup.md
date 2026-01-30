# Setup Retend Web

To render a Retend application in a web environment, you need to configure the active renderer.

## Basic Setup

In your entry file (e.g., `index.js` or `main.js`), import `setActiveRenderer` from `retend` and `DomRenderer` from `retend-web`.

```javascript
import { setActiveRenderer } from 'retend';
import { DomRenderer } from 'retend-web';

// Initialize the renderer with the host element (usually document.body)
const renderer = new DomRenderer(document.body);

// Set it as the active renderer for the framework
setActiveRenderer(renderer);
```

## Mounting Components

Once the renderer is set, appending components to the DOM typically works via standard DOM APIs, because Retend components return real DOM nodes.

```jsx
import { App } from './App';

// Append the App component to the body
document.body.append(<App />);
```

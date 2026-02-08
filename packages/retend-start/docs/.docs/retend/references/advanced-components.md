# Advanced Components

## createUnique

The `createUnique` factory function creates components that preserve their identity and internal state (like video playback, scroll position, input values) across different locations in your application.

> **Note**: For FLIP animations during transitions, see `createUniqueTransition` in `retend-utils.md`.

### Key Features

- **Single Instance**: Only one instance per unique identity exists at a time.
- **State Preservation**: DOM nodes are moved, not recreated.
- **Persistent Setup**: Setup effects run once and persist until all instances are unmounted.

### Basic Usage

```jsx
import { createUnique } from 'retend';

const UniqueContent = createUnique(() => {
  return <video src="video.mp4" controls />;
});

function App() {
  // Moving UniqueContent between different parents will preserve video playback state
  return <UniqueContent />;
}
```

### Usage with IDs

Use the `id` prop to distinguish multiple persistent instances of the same component definition.

```jsx
<UniquePanel id="left-panel" />
<UniquePanel id="right-panel" />
```

### Lifecycle & State

- **`onSetup`**: Runs once on creation. Cleanup runs only when the component is completely removed from the app (not just moved).
- **`onSave` / `onRestore`**: Optional callbacks in the options object to manually save/restore state (like scroll position) during moves.

```javascript
const Scrollable = createUnique(
  () => <div style={{ overflow: 'auto' }}>...</div>,
  {
    onSave: (el) => ({ scrollTop: el.scrollTop }),
    onRestore: (el, data) => {
      el.scrollTop = data.scrollTop;
    },
  }
);
```

# Advanced Components

## createUnique

The `createUnique` factory function creates components that preserve their identity and internal state (like video playback, scroll position, input values) across different locations in your application.

> **Note**: For FLIP animations during transitions, wrap your unique component's content in `UniqueTransition` from `retend-utils/components`.

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
- **`onMove`**: A hook that runs when the unique component moves between locations. Use it to save/restore state during moves.

```javascript
import { createUnique, onMove } from 'retend';

const Scrollable = createUnique(() => {
  onMove(() => {
    const content = document.querySelector('.content');
    const scrollTop = content.scrollTop;
    return () => {
      content.scrollTop = scrollTop;
    };
  });
  return (
    <div class="content" style={{ overflow: 'auto' }}>
      ...
    </div>
  );
});
```

The `onMove` hook receives a callback that runs before the component moves. Return a cleanup/restore function to run after the move completes.

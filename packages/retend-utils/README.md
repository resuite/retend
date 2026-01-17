# retend-utils

This package provides a collection of utility hooks and components for [Retend](https://github.com/resuite/retend/tree/main/packages/retend) applications.

## Table of Contents

- [retend-utils](#retend-utils)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Hooks](#hooks)
    - [`useElementBounding`](#useelementbounding)
    - [`useLiveDate`](#uselivedate)
    - [`useWindowSize`](#usewindowsize)
    - [`useOnlineStatus`](#useonlinestatus)
    - [`useLocalStorage`](#uselocalstorage)
    - [`useSessionStorage`](#usesessionstorage)
    - [`useDerivedValue`](#usederivedvalue)
    - [`useMatchMedia`](#usematchmedia)
    - [`useCursorPosition`](#usecursorposition)
  - [Components](#components)
    - [`Input`](#input)
    - [`FluidList`](#fluidlist)
    - [`createUniqueTransition`](#createuniquetransition)

## Installation

```bash
npm install retend-utils
# or
yarn add retend-utils
# or
bun add retend-utils
```

## Hooks

### `useElementBounding`

Tracks the bounding rectangle (size and position) of an HTML element reactively.

Provides a `BoundingRect` object where each property is a reactive `Cell`. These cells update automatically whenever the element's size or position changes.

**Parameters:**

- `elementRef`: A `Cell<HTMLElement | null>` containing a reference to the HTML element to track.
- `options` (optional): An object with the following properties:
  - `reset` (boolean, default: `true`): Reset the bounding rectangle when the element is removed from the DOM.
  - `windowResize` (boolean, default: `true`): Update when the window is resized.
  - `windowScroll` (boolean, default: `true`): Update when the window is scrolled.
  - `updateTiming` ('sync' | 'next-frame', default: `'sync'`): Timing for updates.

**Returns:**

- `BoundingRect`: An object containing reactive cells for each dimension (`width`, `height`, `x`, `y`, `top`, `right`, `bottom`, `left`).

**Example:**

```tsx
import { Cell } from 'retend';
import { useElementBounding } from 'retend-utils/hooks';

function PositionTracker() {
  const trackedElement = Cell.source(null);
  const bounds = useElementBounding(trackedElement);

  return (
    <>
      <div
        ref={trackedElement}
        style="width: 100px; height: 50px; border: 1px solid black;"
      >
        Track me!
      </div>
      <p>
        Position: X={bounds.x}, Y={bounds.y}
      </p>
      <p>
        Size: Width={bounds.width}, Height={bounds.height}
      </p>
    </>
  );
}
```

### `useLiveDate`

Tracks the current system date and time reactively.

**Parameters:**

- `interval` (optional, number, default: `1000`): How often to update the date and time, in milliseconds.

**Returns:**

- `Cell<Date>`: A Cell containing the current date and time.

**Example:**

```tsx
import { Cell } from 'retend';
import { useLiveDate } from 'retend-utils/hooks';

function CurrentDateDisplay() {
  // Update every 5 seconds
  const currentDate = useLiveDate(5000);
  const dateString = Cell.derived(() => currentDate.get().toDateString());

  return <p>Today's date: {dateString}</p>;
}
```

### `useWindowSize`

Returns an object containing reactive cells that track the current window size.

**Parameters:**

- None

**Returns:**

- An object with two properties:
  - `width`: A Cell containing the current window width.
  - `height`: A Cell containing the current window height.

**Example:**

```tsx
import { Cell } from 'retend';
import { useWindowSize } from 'retend-utils/hooks';

function AdaptiveLayout() {
  const { width } = useWindowSize();
  const isMobile = Cell.derived(() => width.get() < 768);

  return If(isMobile, {
    true: () => <div>Mobile layout</div>,
    false: () => <div>Desktop layout</div>,
  });
}
```

### `useOnlineStatus`

Tracks the network connection status and provides a reactive cell indicating whether the user is currently online.

**Parameters:**

- None

**Returns:**

- `Cell<boolean>`: A cell that contains a boolean indicating whether the network connection is currently online.

**Example:**

```tsx
import { useOnlineStatus, If } from 'retend-utils/hooks';

function NetworkStatusDisplay() {
  const isOnline = useOnlineStatus();

  return (
    <p>
      {If(isOnline, {
        true: () => 'Online',
        false: () => 'Offline',
      })}
    </p>
  );
}
```

### `useLocalStorage`

Creates a reactive cell synchronized with localStorage.

**Parameters:**

- `key` (string): The key to use for storing the value in localStorage.
- `initialValue` (JSONSerializable): The initial value of the cell. Must be a JSON-serializable value.

**Returns:**

- `Cell<JSONSerializable>`: A cell that contains the current value stored in localStorage.

**Example:**

```tsx
import { useLocalStorage } from 'retend-utils/hooks';

function ThemeSwitcher() {
  const theme = useLocalStorage('theme', 'light');

  const toggleTheme = () => {
    theme.set(theme.get() === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <p>Current theme: {theme}</p>
    </>
  );
}
```

### `useSessionStorage`

Creates a reactive cell synchronized with sessionStorage.

**Parameters:**

- `key` (string): The key to use for storing the value in sessionStorage.
- `initialValue` (JSONSerializable): The initial value of the cell. Must be a JSON-serializable value.

**Returns:**

- `Cell<JSONSerializable>`: A cell that contains the current value stored in sessionStorage.

**Example:**

```tsx
import { useSessionStorage } from 'retend-utils/hooks';

function SessionCounter() {
  const count = useSessionStorage('count', 0);

  const increment = () => {
    count.set(count.get() + 1);
  };

  return (
    <>
      <button onClick={increment}>Increment</button>
      <p>Count: {count}</p>
    </>
  );
}
```

### `useDerivedValue`

Creates a derived cell from either a static value or another cell. The returned cell will automatically update when the input cell changes, or remain constant if the input is a static value.

**Parameters:**

- `property` (Cell<T> | T): The input value or cell to derive from

**Returns:**

- `Cell<T>`: A derived cell that reflects the current value of the input

**Example:**

```tsx
import { Cell } from 'retend';
import { useDerivedValue } from 'retend-utils/hooks';

function ExampleComponent(props) {
  const { valueOrCell } = props;
  const derivedValue = useDerivedValue(valueOrCell);

  return <p>Current value: {derivedValue}</p>;
}
```

### `useMatchMedia`

Creates a reactive cell that tracks the result of a media query.

**Parameters:**

- `query` (string): The media query to match (e.g., `(min-width: 768px)`).

**Returns:**

- `Cell<boolean>`: A cell that contains a boolean indicating whether the media query matches.

**Example:**

```tsx
import { Cell } from 'retend';
import { useMatchMedia } from 'retend-utils/hooks';

function MyComponent() {
  const isDarkMode = useMatchMedia('(prefers-color-scheme: dark)');
  return If(isDarkMode, {
    true: () => <div>Dark mode</div>,
    false: () => <div>Light mode</div>,
  });
}
```

### `useCursorPosition`

Tracks the cursor position within the window.

**Parameters:**

- None

**Returns:**

- `CursorPosition`: An object containing reactive cells for the x and y coordinates of the cursor (`x`, `y`).

**Example:**

```tsx
import { useCursorPosition } from 'retend-utils/hooks';

function MyComponent() {
  const { x, y } = useCursorPosition();

  return (
    <div>
      Cursor Position: X: {x}, Y: {y}
    </div>
  );
}
```

## Components

### `Input`

A reactive input component with two-way data binding support for various HTML input types.

**Props:**

- `type` (string): The HTML input type (e.g., "text", "number", "password", "checkbox", "date").
- `model` (Cell<string | number | boolean | Date | File[]>): A reactive cell for two-way data binding. The type of the cell should match the input type.
- `ref` (Cell<HTMLInputElement | null>): Optional reference to the input element.
- `...rest`: Other standard HTML input attributes.

**Example:**

```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function InputExample() {
  const textModel = Cell.source('');

  return (
    <div>
      <Input type="text" model={textModel} placeholder="Enter text" />
      <p>Current value: {textModel}</p>
    </div>
  );
}
```

### `FluidList`

Renders a list with dynamic sizing, staggered animations, and flexible layouts, handling transitions automatically.

**Props:**

- `items`: **Required**. Reactive cell containing the array of items to render.
- `Template`: **Required**. Function returning JSX for each item. Receives `{ item, index, previousIndex, list }`.
- `itemKey`: **Required** for object items. Unique key for each item.
- `ref`: Optional. Cell for the `<ul>` element reference.
- `style`: Optional. Custom styles for the `<ul>` container.
- `direction`: Optional. Item flow direction (`'block'`=horizontal, `'inline'`=vertical). Default: `'block'`.
- `staggeredDelay`: Optional. Staggered animation delay per item (e.g., `'50ms'`). Default: `'0ms'`.
- `itemHeight`: Optional. Fixed item height (e.g., `'50px'`).
- `itemWidth`: Optional. Fixed item width (e.g., `'100px'`).
- `speed`: Optional. Transition duration (e.g., `'0.2s'`). Default: `'0.2s'`.
- `easing`: Optional. Transition easing function (e.g., `'ease-in-out'`). Default: `'ease'`.
- `gap`: Optional. Gap between items (e.g., `'10px'`). Default: `'0px'`.
- `animateSizing`: Optional. Animate item size changes. Default: `false`.
- `maxColumns`: Optional. Max columns before wrapping (for `direction: 'inline'`).
- `maxRows`: Optional. Max rows before wrapping (for `direction: 'block'`).
- `...rest`: Other standard `<ul>` attributes.

**Example:**

```tsx
import { Cell } from 'retend';
import { FluidList, type ListTemplateProps } from 'retend-utils/components';

interface MyItem {
  id: number;
  name: string;
}

const myItems = Cell.source<MyItem[]>([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
]);

function MyItemTemplate({ item, index }: ListTemplateProps<MyItem>) {
  // 'previousIndex' and 'list' are also available if needed
  return (
    <div style="border: 1px solid #ccc; padding: 10px;">
      <h2>{item.name}</h2>
      <p>Current Index: {index}</p>
    </div>
  );
}

function MyComponent() {
  return (
    <FluidList
      items={myItems}
      itemKey="id"
      itemHeight="100px"
      gap="10px"
      direction="inline" // Items flow horizontally, wrap vertically
      maxColumns={2} // Max 2 columns before wrapping
      speed="0.3s"
      easing="ease-in-out"
      staggeredDelay="30ms"
      Template={MyItemTemplate}
      class="my-custom-list"
    />
  );
}
```

### `createUniqueTransition`

A factory function that creates unique components with smooth [FLIP](https://aerotwist.com/blog/flip-your-animations/) animations. When an element created with `createUniqueTransition` moves between different positions in the DOM tree, it automatically animates from its previous position and size to its new position and size using CSS transforms.

**Parameters:**

- `renderFn`: **Required**. A function that returns the JSX to be rendered. Receives props as a reactive Cell.
- `options`: **Required**. An object with transition configuration:
  - `transitionDuration`: The duration of the transition (e.g., `'300ms'`, `'0.5s'`).
  - `transitionTimingFunction`: Optional. The easing function for the transition (e.g., `'ease-in-out'`). Default: `'ease'`.
  - `maintainWidthDuringTransition`: Optional. If true, disables horizontal scaling during transitions.
  - `maintainHeightDuringTransition`: Optional. If true, disables vertical scaling during transitions.
  - `onSave`: Optional. A callback function `(element: HTMLElement) => CustomData` that runs just before the element moves. It can return custom data (e.g., scroll position) to be preserved.
  - `onRestore`: Optional. A callback function `(element: HTMLElement, data: CustomData) => void` that runs after the element arrives at its new location. It receives the element and the data returned from `onSave`.
  - `container`: Optional. Attributes to apply to the wrapper element.

**Returns:**

- A unique component that can be used like any other component. Pass an `id` prop to distinguish multiple instances.

**Example: Persistent Video Player**

A video player that smoothly animates when moving between a sidebar and a main content area.

```tsx
import { createUniqueTransition } from 'retend-utils/components';

const PersistentVideo = createUniqueTransition(
  (props) => {
    const src = Cell.derived(() => props.get().src);
    return <VideoPlayer src={src} />;
  },
  { transitionDuration: '300ms' }
);

function App() {
  return (
    <div>
      <PersistentVideo id="main-video" src="/video.mp4" />
    </div>
  );
}
```

**Example: Picture-in-Picture Transition**

A video that animates between a main view and a picture-in-picture corner.

```tsx
import { Cell, If } from 'retend';
import { createUniqueTransition } from 'retend-utils/components';

const styles = {
  main: { width: '640px', height: '360px' },
  pip: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '200px',
    height: '112px',
  },
};

const VideoPlayer = createUniqueTransition(
  () => <video src="video.mp4" controls />,
  {
    transitionDuration: '300ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  }
);

function App() {
  const isPip = Cell.source(false);
  const isMain = Cell.derived(() => !isPip.get());
  const toggle = () => isPip.set(!isPip.get());

  return (
    <div>
      {If(isMain, () => (
        <div style={styles.main}>
          <VideoPlayer />
        </div>
      ))}
      {If(isPip, () => (
        <div style={styles.pip}>
          <VideoPlayer />
        </div>
      ))}
      <button type="button" onClick={toggle}>
        Toggle PiP
      </button>
    </div>
  );
}
```

**Example: Preserving State**

An item card that animates between a grid and a detail view while preserving its scroll position.

```tsx
import { Cell } from 'retend';
import { createUniqueTransition } from 'retend-utils/components';

const AnimatedCard = createUniqueTransition(
  (props) => {
    const title = Cell.derived(() => props.get().title);
    return (
      <div class="card">
        <h3>{title}</h3>
        <div class="content" style="overflow-y: auto; height: 100px;">
          {/* ... long content ... */}
        </div>
      </div>
    );
  },
  {
    transitionDuration: '300ms',
    onSave: (el) => ({ scrollTop: el.querySelector('.content')?.scrollTop }),
    onRestore: (el, data) => {
      if (data?.scrollTop) {
        const contentEl = el.querySelector('.content');
        if (contentEl) contentEl.scrollTop = data.scrollTop;
      }
    },
  }
);

function ProductGrid() {
  const items = Cell.source([
    { id: 1, title: 'Product A' },
    { id: 2, title: 'Product B' },
  ]);

  return (
    <div class="grid">
      {For(items, (item) => (
        <AnimatedCard id={`card-${item.id}`} title={item.title} />
      ))}
    </div>
  );
}
```

# retend-utils

This package provides a collection of utility hooks for [Retend](https://github.com/resuite/retend/tree/main/packages/retend) applications.

## Table of Contents

- [retend-utils](#retend-utils)
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
  - [Components](#components)
    - [`Input`](#input)

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
  const dateString = Cell.derived(() => currentDate.value.toDateString());

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
  const isMobile = Cell.derived(() => width.value < 768);

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
    theme.value = theme.value === 'light' ? 'dark' : 'light';
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
    count.value = count.value + 1;
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

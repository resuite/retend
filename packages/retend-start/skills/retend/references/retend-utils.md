# Retend Utils Reference

`retend-utils` provides utility hooks and components for common patterns in Retend applications.

## Installation

```bash
npm install retend-utils
```

## Hooks

### useElementBounding

Tracks the bounding rectangle (size and position) of an HTML element reactively.

**Parameters:**
- `elementRef`: Cell<HTMLElement | null> - Reference to the element to track
- `options` (optional):
  - `reset` (boolean, default: true) - Reset bounds when element is removed
  - `windowResize` (boolean, default: true) - Update on window resize
  - `windowScroll` (boolean, default: true) - Update on window scroll
  - `updateTiming` ('sync' | 'next-frame', default: 'sync') - Timing for updates

**Returns:**
- `BoundingRect` - Object with reactive cells for: width, height, x, y, top, right, bottom, left

**Example:**
```tsx
import { Cell } from 'retend';
import { useElementBounding } from 'retend-utils/hooks';

function PositionTracker() {
  const trackedElement = Cell.source(null);
  const bounds = useElementBounding(trackedElement);
  
  return (
    <>
      <div ref={trackedElement} style="width: 100px; height: 50px;">
        Track me!
      </div>
      <p>Position: X={bounds.x}, Y={bounds.y}</p>
      <p>Size: Width={bounds.width}, Height={bounds.height}</p>
    </>
  );
}
```

### useLiveDate

Tracks the current system date and time reactively.

**Parameters:**
- `interval` (optional, number, default: 1000) - Update interval in milliseconds

**Returns:**
- `Cell<Date>` - Cell containing the current date and time

**Example:**
```tsx
import { Cell } from 'retend';
import { useLiveDate } from 'retend-utils/hooks';

function CurrentDateDisplay() {
  const currentDate = useLiveDate(5000); // Update every 5 seconds
  const dateString = Cell.derived(() => currentDate.get().toDateString());
  
  return <p>Today's date: {dateString}</p>;
}
```

### useWindowSize

Returns reactive cells that track the current window size.

**Parameters:**
- None

**Returns:**
- Object with:
  - `width`: Cell<number> - Current window width
  - `height`: Cell<number> - Current window height

**Example:**
```tsx
import { Cell, If } from 'retend';
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

### useOnlineStatus

Tracks the network connection status reactively.

**Parameters:**
- None

**Returns:**
- `Cell<boolean>` - Cell indicating whether the user is online

**Example:**
```tsx
import { If } from 'retend';
import { useOnlineStatus } from 'retend-utils/hooks';

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

### useLocalStorage

Creates a reactive cell synchronized with localStorage.

**Parameters:**
- `key` (string) - The localStorage key
- `initialValue` (JSONSerializable) - Initial value (must be JSON-serializable)

**Returns:**
- `Cell<JSONSerializable>` - Cell synchronized with localStorage

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

### useSessionStorage

Creates a reactive cell synchronized with sessionStorage.

**Parameters:**
- `key` (string) - The sessionStorage key
- `initialValue` (JSONSerializable) - Initial value (must be JSON-serializable)

**Returns:**
- `Cell<JSONSerializable>` - Cell synchronized with sessionStorage

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

### useDerivedValue

Creates a derived cell from either a static value or another cell.

**Parameters:**
- `valueOrCell` (T | Cell<T>) - Either a static value or a reactive cell

**Returns:**
- `Cell<T>` - Derived cell that updates when the input cell changes, or remains constant for static values

**Example:**
```tsx
import { Cell } from 'retend';
import { useDerivedValue } from 'retend-utils/hooks';

function FlexibleComponent(props) {
  const { valueOrCell } = props;
  const derivedValue = useDerivedValue(valueOrCell);
  
  return <p>Current value: {derivedValue}</p>;
}

// Can be used with either:
<FlexibleComponent valueOrCell="static" />
<FlexibleComponent valueOrCell={Cell.source('reactive')} />
```

### useMatchMedia

Creates a reactive cell that tracks the result of a media query.

**Parameters:**
- `query` (string) - The media query to match (e.g., `(min-width: 768px)`)

**Returns:**
- `Cell<boolean>` - Cell indicating whether the media query matches

**Example:**
```tsx
import { If } from 'retend';
import { useMatchMedia } from 'retend-utils/hooks';

function ThemeDetector() {
  const isDarkMode = useMatchMedia('(prefers-color-scheme: dark)');
  
  return If(isDarkMode, {
    true: () => <div>Dark mode</div>,
    false: () => <div>Light mode</div>,
  });
}
```

**Common Media Queries:**
```tsx
// Viewport width
const isMobile = useMatchMedia('(max-width: 767px)');
const isTablet = useMatchMedia('(min-width: 768px) and (max-width: 1023px)');
const isDesktop = useMatchMedia('(min-width: 1024px)');

// Dark mode
const prefersDark = useMatchMedia('(prefers-color-scheme: dark)');

// Reduced motion
const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');

// Print media
const isPrint = useMatchMedia('print');
```

### useCursorPosition

Tracks the cursor position within the window.

**Parameters:**
- None

**Returns:**
- `CursorPosition` - Object containing reactive cells for x and y coordinates

**Example:**
```tsx
import { useCursorPosition } from 'retend-utils/hooks';

function CursorTracker() {
  const { x, y } = useCursorPosition();
  
  return (
    <div>
      Cursor Position: X: {x}, Y: {y}
    </div>
  );
}
```

## Components

### Input

A reactive input component with two-way data binding support for various HTML input types.

**Props:**
- `type` (string) - HTML input type ("text", "number", "password", "checkbox", "date", "file", etc.)
- `model` (Cell<string | number | boolean | Date | File[]>) - Reactive cell for two-way binding
- `ref` (Cell<HTMLInputElement | null>) - Optional reference to the input element
- `...rest` - Other standard HTML input attributes

**Example: Text Input**
```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function TextInputExample() {
  const textModel = Cell.source('');
  
  return (
    <div>
      <Input type="text" model={textModel} placeholder="Enter text" />
      <p>Current value: {textModel}</p>
    </div>
  );
}
```

**Example: Checkbox**
```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function CheckboxExample() {
  const isChecked = Cell.source(false);
  
  return (
    <div>
      <label>
        <Input type="checkbox" model={isChecked} />
        I agree to the terms
      </label>
      <p>Checked: {isChecked}</p>
    </div>
  );
}
```

**Example: Number Input**
```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function NumberInputExample() {
  const age = Cell.source(0);
  
  return (
    <div>
      <Input type="number" model={age} min={0} max={120} />
      <p>Age: {age}</p>
    </div>
  );
}
```

**Example: Date Input**
```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function DateInputExample() {
  const selectedDate = Cell.source(new Date());
  
  return (
    <div>
      <Input type="date" model={selectedDate} />
      <p>Selected: {Cell.derived(() => selectedDate.get().toDateString())}</p>
    </div>
  );
}
```

**Example: File Input**
```tsx
import { Cell } from 'retend';
import { Input } from 'retend-utils/components';

function FileInputExample() {
  const files = Cell.source([]);
  
  return (
    <div>
      <Input type="file" model={files} multiple />
      <p>Files selected: {Cell.derived(() => files.get().length)}</p>
    </div>
  );
}
```

### FluidList

Renders a list with dynamic sizing, staggered animations, and flexible layouts. Automatically handles transitions when items are added, removed, or reordered.

**Props:**
- `items`: **Required**. Cell<T[]> - Reactive cell containing the array of items
- `Template`: **Required**. Function - Returns JSX for each item. Receives `{ item, index, previousIndex, list }`
- `itemKey`: **Required** for object items - String or function to uniquely identify each item
- `ref`: Optional. Cell<HTMLUListElement | null> - Reference to the `<ul>` element
- `style`: Optional. CSS style object for the container
- `direction`: Optional. 'block' (horizontal) or 'inline' (vertical). Default: 'block'
- `staggeredDelay`: Optional. String (e.g., '50ms') - Delay between item animations. Default: '0ms'
- `itemHeight`: Optional. String (e.g., '50px') - Fixed item height
- `itemWidth`: Optional. String (e.g., '100px') - Fixed item width
- `speed`: Optional. String (e.g., '0.2s') - Transition duration. Default: '0.2s'
- `easing`: Optional. String (e.g., 'ease-in-out') - Transition easing. Default: 'ease'
- `gap`: Optional. String (e.g., '10px') - Gap between items. Default: '0px'
- `animateSizing`: Optional. Boolean - Animate item size changes. Default: false
- `maxColumns`: Optional. Number - Max columns before wrapping (for direction: 'inline')
- `maxRows`: Optional. Number - Max rows before wrapping (for direction: 'block')
- `...rest` - Other standard `<ul>` attributes

**Example: Basic List**
```tsx
import { Cell } from 'retend';
import { FluidList } from 'retend-utils/components';

function BasicList() {
  const items = Cell.source(['Apple', 'Banana', 'Cherry']);
  
  return (
    <FluidList
      items={items}
      Template={({ item }) => <div>{item}</div>}
    />
  );
}
```

**Example: Animated Todo List**
```tsx
import { Cell } from 'retend';
import { FluidList, type ListTemplateProps } from 'retend-utils/components';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoList() {
  const todos = Cell.source<Todo[]>([
    { id: 1, text: 'Learn Retend', done: false },
    { id: 2, text: 'Build app', done: false },
  ]);
  
  const addTodo = () => {
    const newTodo = {
      id: Date.now(),
      text: `Task ${todos.get().length + 1}`,
      done: false
    };
    todos.set([...todos.get(), newTodo]);
  };
  
  const removeTodo = (id: number) => {
    todos.set(todos.get().filter(t => t.id !== id));
  };
  
  return (
    <div>
      <button onClick={addTodo}>Add Todo</button>
      <FluidList
        items={todos}
        itemKey="id"
        itemHeight="50px"
        gap="10px"
        staggeredDelay="50ms"
        Template={({ item }: ListTemplateProps<Todo>) => (
          <div class="todo-item">
            <span>{item.text}</span>
            <button onClick={() => removeTodo(item.id)}>Remove</button>
          </div>
        )}
      />
    </div>
  );
}
```

**Example: Grid Layout**
```tsx
import { Cell } from 'retend';
import { FluidList } from 'retend-utils/components';

function PhotoGrid() {
  const photos = Cell.source([
    { id: 1, url: '/photo1.jpg' },
    { id: 2, url: '/photo2.jpg' },
    { id: 3, url: '/photo3.jpg' },
  ]);
  
  return (
    <FluidList
      items={photos}
      itemKey="id"
      itemWidth="200px"
      itemHeight="200px"
      gap="10px"
      direction="inline" // Horizontal flow, wraps vertically
      maxColumns={3}
      speed="0.3s"
      easing="ease-in-out"
      Template={({ item }) => (
        <img src={item.url} alt="Photo" style="width: 100%; height: 100%;" />
      )}
    />
  );
}
```

### createUniqueTransition

A factory function that creates unique components with smooth FLIP animations. When an element moves between different positions in the DOM tree, it automatically animates from its previous position and size to its new position and size.

**Parameters:**
- `renderFn`: **Required**. Function that returns JSX. Receives props as a reactive Cell
- `options`: **Required**. Object with:
  - `transitionDuration`: String (e.g., '300ms', '0.5s') - Duration of the transition
  - `transitionTimingFunction`: Optional. String (e.g., 'ease-in-out') - Easing function. Default: 'ease'
  - `maintainWidthDuringTransition`: Optional. Boolean - Disables horizontal scaling. Default: false
  - `maintainHeightDuringTransition`: Optional. Boolean - Disables vertical scaling. Default: false
  - `onSave`: Optional. Function `(element: HTMLElement) => CustomData` - Runs before element moves
  - `onRestore`: Optional. Function `(element: HTMLElement, data: CustomData) => void` - Runs after element arrives
  - `container`: Optional. Attributes for the wrapper element

**Returns:**
- A unique component that can be used like any other component. Pass an `id` prop to distinguish multiple instances.

**Example: Persistent Video Player**
```tsx
import { Cell } from 'retend';
import { createUniqueTransition } from 'retend-utils/components';

const PersistentVideo = createUniqueTransition(
  (props) => {
    const src = Cell.derived(() => props.get().src);
    return <video src={src} controls />;
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
      <button onClick={toggle}>Toggle PiP</button>
    </div>
  );
}
```

**Example: Preserving Scroll Position**
```tsx
import { Cell, For } from 'retend';
import { createUniqueTransition } from 'retend-utils/components';

const AnimatedCard = createUniqueTransition(
  (props) => {
    const title = Cell.derived(() => props.get().title);
    return (
      <div class="card">
        <h3>{title}</h3>
        <div class="content" style="overflow-y: auto; height: 100px;">
          <p>Long content here...</p>
          <p>More content...</p>
          <p>Even more content...</p>
        </div>
      </div>
    );
  },
  {
    transitionDuration: '300ms',
    onSave: (el) => ({
      scrollTop: el.querySelector('.content')?.scrollTop
    }),
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

## Best Practices

### Hooks

1. **Always use hooks at the component level** - Don't call hooks conditionally or in loops
2. **Combine hooks for complex behavior** - Mix useLocalStorage with useWindowSize for responsive settings
3. **Use useDerivedValue for flexible APIs** - Accept both static values and cells in component props

### Components

1. **Input component** - Use for all form inputs to get automatic two-way binding
2. **FluidList** - Use instead of manual For loops when you need animations or complex layouts
3. **createUniqueTransition** - Perfect for elements that move between different parts of the UI (modals, picture-in-picture, detail views)

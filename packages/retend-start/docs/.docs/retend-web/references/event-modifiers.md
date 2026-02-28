# Event Modifiers

Retend provides event modifiers that are chained to event handlers using `--` syntax. These are shortcuts for common event.preventDefault() and event.stopPropagation() patterns.

## Available Modifiers

- `--prevent` - Calls `event.preventDefault()`
- `--stop` - Calls `event.stopPropagation()`
- `--once` - Event handler fires only once
- `--self` - Handler only fires if event.target is the element itself
- `--passive` - Adds passive event listener (performance optimization)

## Basic Usage

### --prevent

Prevents the default browser behavior.

```tsx
function PreventSubmitForm() {
  const handleSubmit = (event) => {
    alert('Form submit prevented!');
  };

  return (
    <form onSubmit--prevent={handleSubmit}>
      <button type="submit">Submit</button>
    </form>
  );
}
```

**Common use cases:**

- Preventing form submission
- Preventing link navigation
- Preventing context menu

### --stop

Stops event propagation to parent elements.

```tsx
function StopBubbling() {
  const handleParentClick = () => {
    alert('Parent div clicked');
  };

  const handleChildClick = () => {
    alert('Child button clicked, bubbling stopped');
  };

  return (
    <div onClick={handleParentClick}>
      <button onClick--stop={handleChildClick}>Click Child</button>
    </div>
  );
}
```

### --once

Handler fires only once, then removes itself.

```tsx
import { Cell } from 'retend';

function OnceClickButton() {
  const clickCount = Cell.source(0);

  const handleClickOnce = () => {
    clickCount.set(clickCount.get() + 1);
    alert('Clicked once!');
  };

  return (
    <div>
      <button onClick--once={handleClickOnce}>Click Once</button>
      <p>Clicks: {clickCount}</p>
    </div>
  );
}
```

### --self

Handler only fires if the target is the element itself (not a child).

```tsx
function SelfModifierDiv() {
  const handleDivClick = () => {
    alert('Div clicked directly');
  };

  const handleChildClick = () => {
    alert('Child button clicked');
  };

  return (
    <div onClick--self={handleDivClick}>
      <button onClick={handleChildClick}>Click Child</button>
    </div>
  );
}
```

### --passive

Adds a passive event listener for better scrolling performance.

```tsx
function PassiveScrollDiv() {
  const handleScroll = (event) => {
    console.log('Passive scroll event', event);
  };

  return (
    <div
      onScroll--passive={handleScroll}
      style={{ overflow: 'auto', height: '100px' }}
    >
      <p style={{ height: '200px' }}>Scrollable content</p>
    </div>
  );
}
```

**Note:** Passive listeners cannot call `preventDefault()`. Use for scroll, wheel, and touch events.

## Combining Modifiers

Chain multiple modifiers together with `--`:

### --prevent--stop

```tsx
function PreventAndStopSubmitForm() {
  const handleSubmit = (event) => {
    alert('Form submit prevented and bubbling stopped!');
  };

  return (
    <form onSubmit--prevent--stop={handleSubmit}>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### --once--prevent

```tsx
function OncePreventLink() {
  const handleClickOncePrevent = (event) => {
    alert('Link clicked once, default prevented!');
  };

  return (
    <a href="#" onClick--once--prevent={handleClickOncePrevent}>
      Click Once, Prevent Default
    </a>
  );
}
```

### --self--stop

```tsx
function SelfAndStopDiv() {
  const handleDivClickSelfStop = () => {
    alert('Div clicked directly, propagation stopped');
  };

  const handleParentClick = () => {
    alert('Parent div clicked (should not happen)');
  };

  return (
    <div onClick={handleParentClick}>
      <div
        onClick--self--stop={handleDivClickSelfStop}
        style={{ padding: '20px', backgroundColor: 'lightgray' }}
      >
        Click here
      </div>
    </div>
  );
}
```

### --passive--prevent

**Warning:** This combination doesn't work as expected. Passive listeners cannot call preventDefault().

```tsx
function PassivePreventScrollDiv() {
  const handleScroll = (event) => {
    event.preventDefault(); // This will be IGNORED due to passive
    alert('Scroll event - preventDefault will not work due to passive');
  };

  return (
    <div
      onScroll--passive--prevent={handleScroll}
      style={{ overflow: 'auto', height: '100px' }}
    >
      <p style={{ height: '200px' }}>Scrollable content</p>
    </div>
  );
}
```

## Common Patterns

### Form Submission

```tsx
function LoginForm() {
  const handleSubmit = (event) => {
    const formData = new FormData(event.target);
    const username = formData.get('username');
    const password = formData.get('password');
    console.log('Login:', username, password);
  };

  return (
    <form onSubmit--prevent={handleSubmit}>
      <input type="text" name="username" placeholder="Username" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Log In</button>
    </form>
  );
}
```

### Prevent Context Menu

```tsx
function PreventContextMenu() {
  const handleContextMenu = (event) => {
    alert('Context menu prevented!');
  };

  return (
    <div
      onContextMenu--prevent={handleContextMenu}
      style={{ padding: '20px', backgroundColor: 'lightyellow' }}
    >
      Right-click here (context menu prevented)
    </div>
  );
}
```

### Stop Keydown Propagation

```tsx
function StopKeydownPropagation() {
  const handleParentKeydown = () => {
    alert('Parent keydown handler (should not trigger)');
  };

  const handleInputKeydownStop = () => {
    alert('Input keydown handler, propagation stopped');
  };

  return (
    <div onKeyDown={handleParentKeydown}>
      <input
        type="text"
        onKeyDown--stop={handleInputKeydownStop}
        placeholder="Type here (keydown stopped)"
      />
    </div>
  );
}
```

### Focus Event (Once)

```tsx
import { Cell } from 'retend';

function OnceFocusInput() {
  const focusCount = Cell.source(0);

  const handleFocusOnce = () => {
    focusCount.set(focusCount.get() + 1);
    alert('Input focused once!');
  };

  return (
    <div>
      <input
        type="text"
        onFocus--once={handleFocusOnce}
        placeholder="Focus me once"
      />
      <p>Focus Count: {focusCount}</p>
    </div>
  );
}
```

### Passive Wheel Event

```tsx
function PassiveWheelDiv() {
  const handleWheel = (event) => {
    console.log('Passive wheel event', event);
  };

  return (
    <div
      onWheel--passive={handleWheel}
      style={{ overflow: 'auto', height: '100px' }}
    >
      <p style={{ height: '200px' }}>Scrollable content with wheel event</p>
    </div>
  );
}
```

### Self Modifier on Button in Form

```tsx
function SelfButtonInForm() {
  const handleFormClick = () => {
    alert('Form clicked (should not trigger when button is clicked)');
  };

  const handleButtonClickSelf = () => {
    alert('Button clicked directly');
  };

  return (
    <form onClick={handleFormClick}>
      <button type="button" onClick--self={handleButtonClickSelf}>
        Click Button (self)
      </button>
    </form>
  );
}
```

### Mouseover Once

```tsx
import { Cell } from 'retend';

function OnceMouseoverDiv() {
  const hoverCount = Cell.source(0);

  const handleMouseOverOnce = () => {
    hoverCount.set(hoverCount.get() + 1);
    alert('Mouse over triggered once!');
  };

  return (
    <div>
      <div
        onMouseOver--once={handleMouseOverOnce}
        style={{ padding: '20px', backgroundColor: 'lightblue' }}
      >
        Hover me once
      </div>
      <p>Hovers: {hoverCount}</p>
    </div>
  );
}
```

## Event Types

Event modifiers work with all standard DOM events:

### Mouse Events

- `onClick`, `onDblClick`
- `onMouseDown`, `onMouseUp`
- `onMouseEnter`, `onMouseLeave`
- `onMouseOver`, `onMouseOut`
- `onMouseMove`
- `onContextMenu`

### Keyboard Events

- `onKeyDown`, `onKeyUp`, `onKeyPress`

### Form Events

- `onSubmit`
- `onChange`, `onInput`
- `onFocus`, `onBlur`

### Touch Events

- `onTouchStart`, `onTouchEnd`
- `onTouchMove`, `onTouchCancel`

### Scroll/Wheel Events

- `onScroll`
- `onWheel`

### Drag Events

- `onDrag`, `onDragStart`, `onDragEnd`
- `onDragEnter`, `onDragLeave`, `onDragOver`
- `onDrop`

## Performance Considerations

### When to Use --passive

Use `--passive` for:

- Scroll listeners
- Wheel listeners
- Touch listeners (touchstart, touchmove)

**Benefits:**

- Browser can optimize scrolling
- Prevents main thread blocking
- Better performance on mobile

**Don't use --passive if:**

- You need to call `preventDefault()`
- You're conditionally preventing default behavior

### When to Use --once

Use `--once` for:

- One-time initialization handlers
- Confirmation dialogs that should only appear once
- Tutorial/onboarding tooltips

**Benefit:** Automatically cleans up the event listener after first trigger.

## Best Practices

### 1. Combine Related Modifiers

```tsx
// Good - prevents default and stops propagation together
<form onSubmit--prevent--stop={handleSubmit}>

// Less efficient - would need two separate handlers otherwise
<form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmit(e); }}>
```

### 2. Use --self to Avoid Delegation Issues

```tsx
// Without --self, child clicks trigger the handler
<div onClick={handleClick}>
  <button>Child</button> {/* This triggers handleClick */}
</div>

// With --self, only direct clicks on the div trigger the handler
<div onClick--self={handleClick}>
  <button>Child</button> {/* This does NOT trigger handleClick */}
</div>
```

### 3. Prefer Modifiers Over Manual Event Methods

```tsx
// Avoid manual preventDefault/stopPropagation
<form onSubmit={(e) => {
  e.preventDefault();
  e.stopPropagation();
  handleSubmit(e);
}}>

// Prefer modifiers - cleaner and more declarative
<form onSubmit--prevent--stop={handleSubmit}>
```

### 4. Be Careful with --passive

```tsx
// This won't work - preventDefault is ignored
<div onScroll--passive--prevent={handler}>

// If you need preventDefault, don't use passive
<div onScroll--prevent={handler}>

// Use passive only for pure observation
<div onScroll--passive={handler}>
```

# Attributes & Events

`retend-web` provides a familiar API for working with DOM attributes, classes, styles, and events, with built-in reactivity support.

## Classes

The `class` attribute supports strings, arrays, objects, and reactive Cells.

### Basic Usage

```jsx
// String
<div class="btn primary">Click me</div>

// Dynamic String (Cell)
<div class={classNameCell}>...</div>
```

### Conditional Classes (Object Syntax)

Pass an object where keys are class names and values are booleans (or boolean Cells).

```jsx
const mainClass = Cell.source('container');
const isActive = Cell.source(true);

<div
  class={[
    mainClass,
    {
      'is-active': isActive, // Reactive boolean
      hidden: false, // Static boolean
    },
  ]}
>
  Content
</div>;
```

### Arrays

Combine multiple formats using an array.

```jsx
<div class={['btn', { 'btn-active': isActive }, customClassCell]} />
```

## Inline Styles

The `style` attribute accepts strings or objects. Object keys are automatically converted from camelCase to kebab-case (e.g., `backgroundColor` -> `background-color`).

```jsx
const color = Cell.source('red');

<div
  style={{
    color: color, // Reactive value
    backgroundColor: 'blue', // Static value
    marginTop: '10px', // camelCase -> margin-top
  }}
>
  Styled Text
</div>;
```

## Events

Event listeners are added using standard `on[Event]` attributes (e.g., `onClick`, `onInput`).

```jsx
const handleClick = (e) => console.log('Clicked!', e);

<button onClick={handleClick}>Log Event</button>;
```

### Modifiers

You can chain modifiers to event names using `--`.

- `--prevent`: Calls `event.preventDefault()`
- `--stop`: Calls `event.stopPropagation()`
- `--once`: Triggers the listener only once
- `--self`: Triggers only if `event.target === event.currentTarget`
- `--passive`: Uses a passive event listener

**For full list and combinations →** see `references/event-modifiers.md`

```jsx
// Prevent default submission
<form onSubmit--prevent={handleSubmit}>...</form>

// Stop bubbling and prevent default
<div onClick--stop--prevent={handleClick}>...</div>
```

## Standard Attributes

All standard HTML attributes are supported.

- **Boolean Attributes**: Pass `true`, `false`, or a boolean Cell.

  ```jsx
  <input disabled={isDisabledCell} />
  ```

- **innerHTML**: Use `dangerouslySetInnerHTML` for raw HTML injection.
  ```jsx
  <div dangerouslySetInnerHTML={{ __html: '<span>Raw HTML</span>' }} />
  ```

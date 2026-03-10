| title                 | impact | impactDescription                | tags             |
| :-------------------- | :----- | :------------------------------- | :--------------- |
| Lowercase Event Names | Low    | Prevents invalid event handlers. | events, web, jsx |

# Lowercase Event Names

**Context**: Adding event handlers to elements.

**Rule**: Use camelCase event names (same as React): `onClick`, `onMouseEnter`, not `onclick` or `onmouseenter`.

**Why**:

- Retend follows React's JSX event naming convention
- Standard HTML lowercase events won't work
- CamelCase distinguishes Retend events from native DOM events

## Examples

### Invalid

```tsx
// INVALID - lowercase event names
<button onclick={handleClick}>Click me</button>
<div onmouseenter={handleMouseEnter}>Hover me</div>
<input onkeydown={handleKeyDown} />
<form onsubmit={handleSubmit} />
```

### Valid

```tsx
// VALID - camelCase event names
<button onClick={handleClick}>Click me</button>
<div onMouseEnter={handleMouseEnter}>Hover me</div>
<input onKeyDown={handleKeyDown} />
<form onSubmit={handleSubmit} />
```

## Common Event Names

| Invalid (HTML) | Valid (Retend/JSX) |
| -------------- | ------------------ |
| onclick        | onClick            |
| onmousedown    | onMouseDown        |
| onmouseup      | onMouseUp          |
| onmousemove    | onMouseMove        |
| onmouseenter   | onMouseEnter       |
| onmouseleave   | onMouseLeave       |
| onmouseover    | onMouseOver        |
| onmouseout     | onMouseOut         |
| onkeydown      | onKeyDown          |
| onkeyup        | onKeyUp            |
| onkeypress     | onKeyPress         |
| onsubmit       | onSubmit           |
| onchange       | onChange           |
| oninput        | onInput            |
| onfocus        | onFocus            |
| onblur         | onBlur             |

## With Modifiers

Event modifiers also use camelCase base names:

```tsx
// VALID
<button onClick--prevent--stop={handleClick}>
  Click (prevented, stopped)
</button>

<form onSubmit--prevent={handleSubmit}>
  <input onChange={handleChange} />
</form>
```

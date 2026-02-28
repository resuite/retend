# Web Specifics

## Rules
- **Class Attribute Syntax**: Use simple strings for static classes. Use Array or Object syntax for dynamic classes. Never use expressions (like `{['a', 'b']}`) for static classes, and never use string concatenation or ternaries.
  - ✅ `<div class="btn btn-primary" />` (static)
  - ✅ `<div class={['btn', variant, { 'is-active': isActive }]} />` (dynamic)
  - ❌ `<div class={['btn', 'btn-primary']} />` (static array)
  - ❌ `<div class={'btn ' + variant} />` (string concat)
- **Event Naming**: Use camelCase event names (e.g., `onClick`, `onMouseEnter`). Standard HTML lowercase events won't work.
- **Event Modifiers**: Use `--` chained modifiers for common event patterns.
  - ✅ `onClick--prevent={handleClick}` (calls `event.preventDefault()`)
  - ✅ `onClick--stop={handleClick}` (calls `event.stopPropagation()`)
  - ✅ `onClick--once={handleClick}` (triggers listener only once)
  - ✅ `onScroll--passive={handleScroll}` (better performance)
- **Teleport**: Use the `<Teleport to="selector">` component.
  - **Selector Limitations**: Teleport only supports `#id` or `tagname` selectors. No class names or attribute selectors.
- **ShadowRoot**: Use the `<ShadowRoot />` component. Always uses `open` mode. The `mode` prop is not supported.
- **Standard Attributes**: All standard HTML attributes are supported.
  - **Boolean Attributes**: Pass `true`, `false`, or a boolean Cell.
  - **dangerouslySetInnerHTML**: Use for raw HTML injection (e.g., `<div dangerouslySetInnerHTML={{ __html: '...' }} />`).
- **onConnected vs onSetup**: Use `onConnected(ref, (node) => { ... })` for measuring or manipulating DOM nodes, not `onSetup`. `onConnected` guarantees the node is in the DOM.
- **Prefer Input Component**: Use the `Input` component from `retend-utils` for two-way binding.
  - ✅ `<Input model={nameCell} />`
- **Button Type**: Always specify the `type` attribute on buttons (e.g., `type="button"`).
- **Label for**: Use `for` attribute for labels, not `htmlFor`.
- **SVG xmlns**: All elements within an SVG must have the `xmlns` attribute.

## Components & Hooks (retend-utils)
- **FluidList**: Renders an animated list with dynamic sizing, staggered animations, and flexible layouts.
- **createUniqueTransition**: Persistent components with smooth FLIP animations across DOM moves.
- **useElementBounding**: Tracks size and position reactively.
- **useWindowSize**: Reactive cells for window width and height.
- **useLocalStorage**: Reactive cell synchronized with localStorage.
- **useMatchMedia**: Reactive cell that tracks media query result.

## Setup & Hydration
- **Hydration Mode**: Call `renderer.enableHydrationMode()` before `renderer.render(<App />)` to match server-rendered nodes.
- **activeRenderer**: Configure with `setActiveRenderer(new DOMRenderer(window))`.

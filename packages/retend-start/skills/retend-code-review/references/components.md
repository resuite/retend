# Components

## Rules
- **PascalCase Names**: Components MUST be PascalCase. Lowercase is treated as HTML.
- **Prop Destructuring**: Always destructure props in the function body, not in parameter list.
  - ✅ `function Button(props) { const { children, onClick } = props; ... }`
  - ❌ `function Button({ children, onClick }) { ... }`
- **Structure Order**:
  - (1) Destructure props
  - (2) State Cells (`Cell.source()`)
  - (3) Derived Cells (`Cell.derived()`, `Cell.derivedAsync()`)
  - (4) Event handlers (hoisted named functions)
  - (5) Effects (`.listen()`, `onSetup()`, `onConnected()`)
  - (6) Return JSX
- **Hoisted Handlers**: Define as named functions before JSX. Do not use inline arrows.
- **Component-Scoped Listeners**: Call `.listen()` directly in component body. Do NOT wrap in `onSetup()`.
- **JSX.Children Type**: Always use `JSX.Children`.
- **ValueOrCell<T>**: Use for props that can be static or reactive. Unwrap with `useDerivedValue` if necessary.
- **Extend Intrinsic Elements**: Wrapper components should extend `JSX.IntrinsicElements['element']` and spread `{...rest}` to preserve reactivity and standard behavior.
- **Fragment Shorthand**: Use `<></>`. Do not import `Fragment`.
- **Button Type**: Always specify `type` attribute (e.g., `type="button"`).
- **Label for**: Use `for` attribute for labels, not `htmlFor`.
- **No any type**: Use proper types or `unknown`.
- **Function Children**: Alias function children to a PascalCase variable and render as a component.
  - ✅ `const { children: Children } = props; return <Children />`
  - ❌ `return <>{children()}</>`
- **Class Merging**: Use array syntax to merge internal classes with user-provided `class` prop.
  - ✅ `<div class={['base-class', props.class]}>...</div>`

## Patterns
- **onConnected**: Use `onConnected(ref, (node) => { ... })` for DOM connection awareness, not `onSetup`.
- **Top-Level Hooks**: Call hooks at the top level of your component function.
- **Lifecycle**: Components run exactly ONCE. State updates do not re-run the component function.
- **SVG Namespaces**: All elements within an SVG must have `xmlns` attribute.

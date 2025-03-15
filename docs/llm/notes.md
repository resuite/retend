# Retend Generation Notes.

**general notes**

- Always adhere to Retend JSX rules.
- Never use React/Solid/Vue/etc.
- Don't make mistakes.
- Do not make assumptions.
- Document every function/component/etc with JSDoc.
- Keep every component/function/etc small.
- Keep every component/function/etc small.
- A component should not be more than 100 lines of code.
- When generating multiple files, annotate the top of each file with the path to the file.
- When generating multiple files, annotate the top of each file with the path to the file.

**docs/llm/0-jsx.txt**

- Retend requires self-closing tags for elements with no children.
- All buttons must have a type attribute in Retend.
- Retend uses 'for' attribute, not 'htmlFor'.
- SVG elements and all their children must have the `xmlns` attribute.
- hr tag must be self-closing.
- br tag must be self-closing.
- Boolean attributes can omit '=true'.

**docs/llm/1-components.txt**

- Component names must be PascalCase.
- If props are defined, they must be destructured at the start of the component.
- Always use `class: className` to destructure reserved word 'class'.
- Access children directly by destructuring `props.children`.
- Boolean props on components can omit `=true`.
- Do not use Array.map to loop over items in Retend JSX.
- Items are passed directly as JSX array.
- Retend uses 'for', not 'htmlFor'.
- Prop object can be spread when passing down to other elements/components.

**docs/llm/2-class-attributes.txt**

- Multiple classes can be specified as a space-separated string.
- Class can be an array of strings.
- Class can be an object where keys are class names and values are booleans.
- Falsy values in class object exclude the class.
- Reactive values in class object are converted to strings.
- Falsy values in class arrays are ignored.
- Falsy values in class objects are ignored.
- Empty string in class attribute has no effect.
- Nested arrays within class arrays are treated as single level.
- Number keys are not valid class names.
- Class names can contain special characters.
- Class can be a mix of arrays and objects.

**docs/llm/3-cell.txt**

- The cell `message` is used directly in JSX to maintain reactivity.
- The cell `url` is used directly for the `href` attribute to ensure reactivity.
- Boolean attributes like `disabled` use cells directly.
- The cell `color` is used within the style object for reactivity.
- A derived cell computes the class name reactively.
- `For` is used to render the list items reactively.
- do not use .map to loop over items in Retend JSX.
- A derived cell accesses the `name` property reactively.
- do not use `value` attribute for input elements.
- A derived cell computes the class name reactively.
- `.value` is used in JS only for initial comparison, not reactivity.
- Class can be an array of Cellular strings.
- `If` is used for conditional rendering.
- do not use ternary operators for conditional rendering.
- event handlers should be preferred outside of the JSX, if possible.

**docs/llm/4-if.txt**

- `If` is used for conditional rendering.
- do not use ternary operators for conditional rendering.
- `If` is used for conditional rendering.
- do not use ternary operators for conditional rendering.

**docs/llm/5-switch.txt**

- A default case is provided to handle values that do not match any defined cases.
- When no case matches and no default is provided, nothing is rendered for the Switch.
- The default case function receives the switch value as its first argument.
- Cases can directly be functions that return JSX templates.
- Default case can also use arrow function syntax.

**docs/llm/6-for.txt**

- Use `For` instead of `.map` for looping in Retend JSX.
- The `index` is a `Cell<number>`; use it directly in JSX for reactivity.
- `Cell.source` makes the list reactive; updates to `items.value` will re-render the list.
- Use `If` inside `For` for conditional rendering, not ternaries.

**docs/llm/7-observer.txt**

- in Typescript, the cell call should be typed as `Cell.source<HTMLDivElement | null>(null)`.
- in Typescript, the cell call should be typed as `Cell.source<HTMLParagraphElement | null>(null)`.
- handlers and event listeners should be declared before observer.onConnected is called.
- Prefer creating handlers and event listeners outside JSX, if possible.

**docs/llm/8-event-modifiers.txt**

- When combining `passive` with `prevent`, `passive` will take precedence, and `preventDefault` will not be called.

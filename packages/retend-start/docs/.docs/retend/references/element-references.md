# Element References

A `ref` is a "pointer" to an element created using JSX, allowing direct interaction with the underlying DOM node.

## Usage

### 1. Create a Reactive Cell

Create a `Cell` to store the reference. It typically starts as `null`.

```javascript
import { Cell } from 'retend';

const elementRef = Cell.source(null);
```

### 2. Link with `ref` Attribute

Assign the Cell to the `ref` attribute of an element in JSX.

```jsx
<div ref={elementRef}>Hello world!</div>
```

### 3. Access the Element

Access the element via `.get()`.

```javascript
const div = elementRef.get(); // returns the HTMLDivElement
```

## Why use refs?

- **Direct Connection**: More reliable than `querySelector` as it doesn't depend on fragile IDs or class names.
- **Reactivity**: Works with `useObserver` (see `control-flow.md`) to react to element connection/disconnection.
- **Locality**: Keeps logic local to the component.

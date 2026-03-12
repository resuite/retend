# retend-opentui

Retend bindings for building terminal UIs with [OpenTUI](https://github.com/anomaly/opentui).

## What It Provides

This package exports:

- `renderToCLI(App, config?)` to create an OpenTUI CLI renderer, mount a Retend app into it, and run setup effects
- `OpenTuiRenderer`, the Retend renderer implementation backed by OpenTUI
- JSX intrinsic element support for OpenTUI renderables such as `<box>`, `<text>`, `<input>`, and `<scrollbox>`

## Installation

```bash
npm install retend-opentui retend @opentui/core
```

## JSX Setup

Use Retend's JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "retend"
  }
}
```

`retend-opentui` augments `retend/jsx-runtime` with the OpenTUI intrinsic elements.

## Quick Start

```tsx
import { Cell } from 'retend';
import { renderToCLI } from 'retend-opentui';

function App() {
  const count = Cell.source(0);
  const increment = () => count.set(count.get() + 1);

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center">
      <box borderColor="green" borderStyle="double" paddingX={2} paddingY={1}>
        <text>count: {count}</text>
        <box onMouseDown={increment}>
          <text fg="yellow">increment</text>
        </box>
      </box>
    </box>
  );
}

await renderToCLI(App, {
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
```

## API

### `renderToCLI(App, config?)`

Creates an OpenTUI `CliRenderer`, wraps it in `OpenTuiRenderer`, sets it as the active Retend renderer, renders `App`, and runs pending setup effects.

- `App`: `() => JSX.Template`
- `config`: optional OpenTUI `CliRendererConfig`
- returns: `Promise<OpenTuiRenderer>`

### `OpenTuiRenderer`

Retend renderer implementation for OpenTUI. It mounts rendered nodes directly into the underlying OpenTUI root renderable.

## Supported JSX Elements

The package currently wires these intrinsic elements into Retend JSX:

- `<box>`
- `<text>`
- `<b>`
- `<i>`
- `<br>`
- `<input>`
- `<select>`
- `<ascii_font>`
- `<tab_select>`
- `<scrollbox>`
- `<code>`
- `<textarea>`
- `<markdown>`

These map to the corresponding OpenTUI renderables and accept their OpenTUI option props.

## Examples

Example apps live under [`examples`](./examples):

- [`todo-list`](./examples/todo-list)
- [`snake-game`](./examples/snake-game)

Each example has its own `entry.tsx` that uses `renderToCLI`.

## Build

```bash
npm run build
```

## Notes

- `retend` is a peer dependency.
- OpenTUI component props use OpenTUI names such as `fg`, `borderColor`, `borderStyle`, `alignItems`, and `justifyContent`.

## Links

- [Retend repository](https://github.com/resuite/retend)
- [OpenTUI repository](https://github.com/anomaly/opentui)

# retend-gpui

`retend-gpui` renders [Retend](https://github.com/resuite/retend) components with GPUI through Retend's own native bridge. It is for native desktop interfaces built with Retend's JSX and reactive cells.

## Status

This package is experimental. The Retend-owned native protocol and renderer API are still under development.

## Install

`retend-gpui` is not published yet. Until the Phase 4 native packaging work is complete, use the workspace package and examples in this repository; registry installation is not supported.

## Quick start

Create a component with Retend's JSX, then pass it to `renderToGpui`:

```tsx
import { Cell } from 'retend';
import { renderToGpui } from 'retend-gpui';

function App() {
  const count = Cell.source(0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        width: '100%',
        height: '100%',
      }}
    >
      <div>Count: {count}</div>
    </div>
  );
}

await renderToGpui(App, {
  title: 'Counter',
  width: 640,
  height: 420,
});
```

The renderer opens a GPUI window through the Retend-owned native binding and submits the Retend tree through the binary command protocol. `renderToGpui` resolves with the `RetendGpuiRenderer` if the application needs to inspect or dispose of the renderer later.

## Vite development

Vite-managed applications separate process-wide setup from per-window rendering. The application module default-exports a class with a stable `context` object:

```ts
import type { GpuiApplication } from 'retend-gpui';

export default class Application implements GpuiApplication<{
  database: Database | null;
}> {
  readonly context = { database: null };

  async init() {
    this.context.database = await openDatabase();
  }

  async cleanup() {
    await this.context.database?.close();
  }
}
```

Configure the application class, the per-window root component, application metadata, and the initial window in `vite.config.ts`:

```ts
import { retendGpui } from 'retend-gpui/plugins/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    retendGpui({
      app: {
        name: 'Notes',
        identifier: 'com.example.notes',
        version: '1.0.0',
        icon: './assets/icon.png',
      },
      application: './source/application.ts',
      entry: './source/main.tsx',
      window: { width: 900, height: 640 },
    }),
  ],
});
```

Run `retend-gpui dev`. It starts Vite without an HTTP listener and forks one Node.js application process with the configured initial window. Applications can open additional independent windows through `useWindow().open(options)`. Vite full reloads recreate application/module state and remount every live window without replacing its native window or navigation history; Vite/config restarts replace the whole application process.

Components read process-wide resources with `useAppContext()`. The development command generates the configured context type under `node_modules/@types/retend-gpui-app`.
TypeScript discovers it automatically unless `compilerOptions.types` limits the loaded packages. In that case, add `"retend-gpui-app"` to that list after the existing GPUI JSX type.

```tsx
import { useAppContext, useWindow } from 'retend-gpui';

export default function App() {
  const { database } = useAppContext();
  const window = useWindow();

  return <div>{database ? window.title : 'Database unavailable'}</div>;
}
```

`useWindow()` returns the window associated with the current Retend root. Its readonly `width` and `height` Cells track native resize events, its `title` Cell writes through to the OS window, `open(options)` creates another independent native window, and `close()` requests closure of the current window.

## TypeScript and JSX

Configure TypeScript to use Retend's JSX runtime and the `retend-gpui` JSX types:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "retend",
    "types": ["retend-gpui/jsx-runtime"]
  }
}
```

The component passed to `renderToGpui` must return Retend JSX. `retend-gpui` does not use the browser DOM, so browser-only elements and APIs are not available.

## Elements

The currently implemented Retend GPUI intrinsic surface is deliberately small:

- `div`
- `anchored`
- `img`
- `input`
- `textarea`
- `button`

Text is ordinary JSX content rather than a `<text>` intrinsic. Adjacent text nodes, including JSX interpolations such as `Count: {count}`, render as one inline run that wraps with its container. `input` uses the native single-line editor, while `textarea` uses the native multi-line editor with wrapping and optional `minRows`/`maxRows` auto-sizing. Both accept a `placeholder`, shown while the control is empty.

`anchored` is the native floating-layer primitive used by menus, tooltips, and similar floating controls. It delegates placement to GPUI rather than measuring in JavaScript. `side` (`top`/`right`/`bottom`/`left`), `align` (`start`/`center`/`end`), `gap`, and `offset` place content relative to its parent slot; `position={{ x, y }}` instead uses window coordinates. `fit="snap"` (the default) keeps the layer inside the window with `snapMargin`, while `fit="switch"` uses GPUI's anchor-flipping behavior. Layers are deferred and occluding by default; `deferred`, `priority`, and `occlude` expose those native controls directly. Margins are intentionally unsupported on `<anchored>` because GPUI requires an anchored child to be margin-free; use `gap`/`offset`, or put the anchored element inside a wrapper when ordinary layout margin is needed.

`button` is a native control with default styling: it centers its children in a padded, rounded, neutral surface with a hairline border and activates on click or Enter/Space when focused. It participates in Tab traversal by default, like native text controls. `disabled` skips it in Tab traversal, ignores pointer and keyboard activation, and renders it dimmed.

```tsx
const count = Cell.source(0);

return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div>Clicked {count} times</div>
    <button onClick={() => count.set(count.get() + 1)}>Increment</button>
  </div>
);
```

`input` and `textarea` are native controls with default styling: comfortable padding, a 6px corner radius, a white surface, and a hairline border. Author style declarations override those defaults per field, so a form field needs no surface styling of its own.

## Events

Retend GPUI exposes JSX handlers for native pointer/button events and `keydown`/`keyup`, plus the `mousedownoutside` extension. Retend owns capture/target/bubble propagation over the logical node tree, and GPUI nodes also expose `addEventListener()`, `removeEventListener()`, and `dispatchEvent()` for imperative/custom events. `mouseenter` and `mouseleave` are non-bubbling; `mousedownoutside` is target-only for each qualifying subscriber. Focus/blur, input/change, and element-scroll events are delivered from the native focus, editor, and scrolling systems. IME/composition remains native editor state; separate JavaScript composition lifecycle events are outside v1.

## Reactive values

Retend cells can drive text, properties, and styles:

```tsx
const label = Cell.source('Waiting');
const color = Cell.derived(() =>
  label.get() === 'Ready' ? '#00aa66' : '#777777'
);

return <div style={{ color }}>{label}</div>;
```

The renderer also handles asynchronous Retend values used for text, control flow, intrinsic properties, and top-level style properties.

The Retend-owned bridge parses its typed authoring vocabulary into Retend-native Rust values. The renderer publishes each resolved author style as one complete sparse snapshot; declarations disappear when omitted from the next replacement snapshot. The surface includes block/flex layout, alignment and gaps, dimensions, spacing, positioning, colors/opacity, borders, inherited text styling, overflow/scrolling, hover/focused/active pseudo-states, and native transitions for the supported animatable properties. Numbers are logical pixels; dimensions also accept `auto`, pixel strings, and percentages.

The application root defaults to a white background with black text. Explicit root `backgroundColor` and `color` styles override these defaults.

## Window options

`renderToGpui` accepts the window options currently implemented by the Retend-owned bridge:

```tsx
await renderToGpui(App, {
  title: 'My app',
  width: 900,
  height: 600,
});
```

Initial width, height, title, resizable state, fullscreen/maximized state, and minimum/maximum size constraints are applied by the native window bridge. Vite-managed applications can open additional independent windows through `useWindow().open(options)`. `useWindow().width` and `height` are readonly Cells kept current by native resize events, while the bound window object emits per-window `focus` and `blur` lifecycle events.

## Platform notes

The macOS GPUI backend is a patched `gpui-pre-macos` 0.3.4 snapshot. The patched crate lives in the sibling `gpui-pre` repo (`crates/gpui-pre-macos`), not in this tree. The patch adds an embedded NSApplication / CFRunLoop pump so GPUI can run inside the Node/napi process.

The Retend-owned runtime owns process keep-alive while native windows exist. On macOS a `CVDisplayLink` hops onto the process main thread to pump AppKit/GPUI at display refresh; applications do not run a JavaScript frame timer. `retend-gpui` is a native renderer and does not run in a browser.

## Lower-level API

Most applications should use `renderToGpui`. For custom startup or testing, create the renderer yourself:

```ts
import { RetendGpuiRenderer } from 'retend-gpui';

const renderer = new RetendGpuiRenderer();
renderer.init({ title: 'My app', width: 900, height: 600 });
renderer.render(App);
```

Call `renderer.flush()` after making changes when you manage rendering manually. Call `renderer.dispose()` when the application is finished with the renderer. `renderer.host` exposes the window-local navigation facade and Retend-owned native command host.

## Troubleshooting

### Unsupported intrinsic element

If the renderer throws an error for an element, check that the tag is in the supported list above. HTML elements such as `section`, `span`, and `a` are not automatically available.

### Development Dock identity on macOS

The dev child sets its process title from `app.name`, but native application bundle identity and Dock-icon integration are not implemented yet. The Dock may therefore still show Node's icon/identity even when `app.name` and `app.icon` are configured. Those fields remain canonical production metadata.

### JSX types are missing

Make sure the application has both `jsxImportSource: "retend"` and `types: ["retend-gpui/jsx-runtime"]` in its TypeScript configuration. Also make sure the JSX file uses a `.tsx` extension.

# retend-gpui

`retend-gpui` renders [Retend](https://github.com/resuite/retend) components with GPUiX and GPUI. It is for native desktop interfaces built with Retend's JSX and reactive cells, using GPUiX's native renderer underneath.

## Status

This package is experimental. The API and the supported GPUiX properties may change as GPUiX and the Retend renderer integration develop.

## Install

```bash
pnpm add retend retend-gpui
```

`retend-gpui` installs its compatible `@gpuix/native` dependency automatically. Use the same package manager to install it in applications that do not use pnpm.

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
      <div onClick={() => count.set(count.get() + 1)}>Increment</div>
    </div>
  );
}

await renderToGpui(App, {
  title: 'Counter',
  width: 640,
  height: 420,
});
```

The renderer creates the GPUiX window, renders the component, and starts GPUiX's frame processing. `renderToGpui` resolves with the `RetendGpuiRenderer` if the application needs to inspect or dispose of the renderer later.

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

Run `retend-gpui dev`. It starts Vite without an HTTP listener and forks one Node.js application process. The current GPUiX 0.4.0 development host supports one production native window; multi-window support is deferred until the native bridge can address multiple windows independently.

Components read process-wide resources with `useAppContext()`. The development command generates the configured context type under `node_modules/@types/retend-gpui-app`.
TypeScript discovers it automatically unless `compilerOptions.types` limits the loaded packages. In that case, add `"retend-gpui-app"` to that list after the existing GPUI JSX type.

```tsx
import { useAppContext, useWindow } from 'retend-gpui';

export default function App() {
  const { database } = useAppContext();
  const window = useWindow();

  return (
    <div onClick={() => window.title.set('Details')}>
      {database ? 'Database ready' : 'Database unavailable'}
    </div>
  );
}
```

`useWindow()` returns the window associated with the current Retend root. Its `width` and `height` Cells are populated from GPUiX's `getWindowSize()`, and setting its `title` Cell updates the OS title. GPUiX 0.4.0 currently reports a fixed placeholder size, so live resize updates depend on an upstream GPUiX fix.

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

The v1 Retend GPUI intrinsic surface is deliberately small:

- `div`
- `img`
- `input`
- `textarea`

Text is ordinary JSX content rather than a `<text>` intrinsic. `input` and `textarea` remain part of the v1 intrinsic vocabulary, but their Retend-owned native editor/focus/selection implementation belongs to Phase 3. Build higher-level controls and widgets as Retend components from these primitives.

## Events

The normal renderer still uses GPUiX for events until the Retend-owned Phase 2 event transport is migrated. On that current path, use JSX event props for the events GPUiX reports:

```tsx
<input
  value={query}
  placeholder="Search"
  onChange={(event) => query.set(event.value ?? '')}
  onSubmit={submit}
/>
```

Supported events are `change`, `submit`, `click`, `mouseDown`, `mouseUp`, `mouseEnter`, `mouseLeave`, `mouseMove`, `mouseDownOutside`, `keyDown`, `keyUp`, `focus`, `blur`, and `scroll`.

GPUiX event handlers receive an `EventPayload` from `@gpuix/native`. The payload fields depend on the event. Input changes, for example, expose the new value as `event.value`.

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

The Retend-owned Phase 2 bridge parses its typed authoring vocabulary into Retend-native Rust values. Its current static surface covers block/flex layout, flex direction/wrapping/alignment, gaps, dimensions, padding/margins, relative/absolute positioning, colors/opacity, borders, and basic inherited text styling. Numbers are logical pixels; dimensions also accept `auto`, pixel strings, and percentages. The normal renderer is migrated onto that native style path later in Phase 2. Stateful overflow/scroll behavior belongs to Phase 3 and the target style-driven transition/pseudo-state model belongs to Phase 4.

The application root defaults to a white background with black text. Explicit root `backgroundColor` and `color` styles override these defaults.

## Window options

Pass GPUiX window options as the second argument to `renderToGpui`:

```tsx
await renderToGpui(App, {
  title: 'My app',
  width: 900,
  height: 600,
  minWidth: 480,
  minHeight: 320,
});
```

The available options come from `WindowOptions` in `@gpuix/native`.

## Platform notes

On macOS, GPUiX needs JavaScript to call `tick()` while the application is running. `renderToGpui` starts that loop for you. On Linux and Windows, GPUiX owns the UI thread and the package does not start a JavaScript frame timer.

Because this renderer uses GPUiX's native bindings, your application must run in an environment supported by the installed `@gpuix/native` version. It will not run in a browser.

## Lower-level API

Most applications should use `renderToGpui`. For custom startup or testing, create the renderer yourself:

```ts
import { RetendGpuiRenderer } from 'retend-gpui';

const renderer = new RetendGpuiRenderer();
renderer.init({ title: 'My app', width: 900, height: 600 });
renderer.render(App);
```

Call `renderer.flush()` after making changes when you manage rendering manually. Call `renderer.dispose()` when the application is finished with the renderer. `renderer.host` exposes the `GpuiHost`, which batches native mutations and manages the platform frame loop.

## Troubleshooting

### Unsupported intrinsic element

If the renderer throws an error for an element, check that the tag is in the supported list above. HTML elements such as `button`, `section`, and `span` are not automatically available.

### Window does not update on macOS

Use `renderToGpui`, or start the host frame loop after manual initialization:

```ts
renderer.host.startFrameLoop();
```

### Development Dock identity on macOS

The dev child sets its process title from `app.name`, but GPUiX 0.4.0 does not expose APIs for native application bundle identity or Dock icons. The Dock may therefore still show Node's icon/identity even when `app.name` and `app.icon` are configured. Those fields remain canonical metadata for a future native development host and production bundle.

### JSX types are missing

Make sure the application has both `jsxImportSource: "retend"` and `types: ["retend-gpui/jsx-runtime"]` in its TypeScript configuration. Also make sure the JSX file uses a `.tsx` extension.

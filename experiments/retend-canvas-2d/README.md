# retend-canvas-2d

A Canvas 2D renderer for [retend](https://github.com/resuite/retend), enabling you to write reactive JSX components that render to an HTML5 `<canvas>` context.

## Overview

`retend-canvas-2d` builds and manages a virtual scene tree of canvas nodes, efficiently translating JSX and reactive `Cell` state into batched canvas draw calls. It uses a dual-canvas hit-testing strategy to support pointer events on arbitrary shapes, and ships with first-class support for rendering inside a **Web Worker** via `OffscreenCanvas` for buttery-smooth, jank-free rendering.

## Features

- **JSX elements** — `<rect>`, `<circle>`, `<text>`, `<img>`, `<path>`, `<shape>`, `<particles>`
- **CSS-inspired styling** — layout, typography, transforms, borders, shadows, overflow, opacity, clip paths
- **Animations & transitions** — keyframe animations and CSS-like property transitions with cubic-bezier easing
- **Pointer events** — `click`, `pointerdown`, `pointermove`, `pointerup` with accurate hit testing and pointer capture
- **Web Worker rendering** — off-main-thread rendering via `OffscreenCanvas`
- **Reactive updates** — `Cell`, `Cell.derived`, and `Cell.derivedAsync` from `retend` (built on [`@adbl/cells`](https://github.com/adebola-io/cells))
- **Particles** — efficient rendering of large point clouds with per-particle color and size maps

## Installation

```bash
pnpm add retend retend-canvas-2d
```

## Quick Start

### Main thread (your component)

```tsx
import { Cell } from 'retend';
import { Length, BorderStyle } from 'retend-canvas-2d';
import 'retend-canvas-2d/jsx-runtime';

export function App() {
  const count = Cell.source(0);
  const increment = () => count.set(count.get() + 1);

  return (
    <rect style={styles.container} onClick={increment}>
      <text style={styles.text}>Clicks: {count}</text>
    </rect>
  );
}

const styles = {
  container: {
    width: Length.Px(200),
    height: Length.Px(80),
    backgroundColor: '#4f46e5',
    borderRadius: Length.Px(12),
  },
  text: {
    color: 'white',
    fontSize: Length.Px(18),
  },
};
```

### Worker (rendering thread)

```ts
// app.worker.ts
import { setupWorkerContext } from 'retend-canvas-2d/worker';
import { App } from './app';
import 'retend-canvas-2d/jsx-runtime';

setupWorkerContext(App);
```

### Entry point (connect canvas to worker)

```ts
// main.ts
import { connectToWorkerContext } from 'retend-canvas-2d/main';
import AppWorker from './app.worker.ts?worker';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const worker = new AppWorker();

const ref = connectToWorkerContext(canvas, worker);

// Notify the renderer when the canvas is resized
const observer = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  ref.resize(width, height);
});
observer.observe(canvas);
```

### Direct rendering (no worker)

If you don't need off-thread rendering you can render directly to a context:

```ts
import { renderToCanvasContext } from 'retend-canvas-2d';
import { App } from './app';
import 'retend-canvas-2d/jsx-runtime';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const renderer = await renderToCanvasContext(ctx, App);
```

`renderToCanvasContext` paints the first frame for you. Later updates usually schedule a render via `requestAnimationFrame` automatically; call `renderer.drawToScreen()` if you need an extra synchronous repaint. For `onClick` / pointer handlers, forward DOM events on the canvas to `renderer.dispatchEvent(...)` (see `retend-canvas-examples` in this repo).

## JSX Elements

| Element       | Description                                            |
| ------------- | ------------------------------------------------------ |
| `<rect>`      | Rectangular box, optionally rounded via `borderRadius` |
| `<circle>`    | Circle inscribed in the element’s width/height box      |
| `<text>`      | Inline text node with full text-cascade support        |
| `<img>`       | Bitmap image loaded from a URL                         |
| `<path>`      | Arbitrary SVG path string via the `d` prop             |
| `<shape>`     | Closed polygon defined by a `points` array             |
| `<particles>` | High-performance point cloud                           |

## Styling

Styles are passed via the `style` prop as a typed `CanvasStyle` object.

```tsx
import { BoxShadow, Length } from 'retend-canvas-2d';

<rect
  style={{
    width: Length.Px(300),
    height: Length.Pct(50),
    backgroundColor: '#0ea5e9',
    borderRadius: Length.Px(8),
    opacity: 0.9,
    boxShadow: BoxShadow.Drop(
      Length.Px(0),
      Length.Px(4),
      Length.Px(12),
      'rgba(0,0,0,0.3)'
    ),
  }}
/>
```

### Layout

| Property       | Type             | Description                             |
| -------------- | ---------------- | --------------------------------------- |
| `left`         | `LengthValue`    | X position within the parent            |
| `top`          | `LengthValue`    | Y position within the parent            |
| `width`        | `LengthValue`    | Element width (default: `100%`)         |
| `height`       | `LengthValue`    | Element height (default: `fit-content`) |
| `maxWidth`     | `LengthValue`    | Maximum width constraint                |
| `maxHeight`    | `LengthValue`    | Maximum height constraint               |
| `overflow`     | `OverflowValue`  | `Overflow.Visible` or `Overflow.Hidden` |
| `zIndex`       | `number`         | Stacking order                          |
| `justifyItems` | `AlignmentValue` | Horizontal alignment of children        |
| `alignItems`   | `AlignmentValue` | Vertical alignment of children          |
| `justifySelf`  | `AlignmentValue` | Override horizontal alignment for self  |
| `alignSelf`    | `AlignmentValue` | Override vertical alignment for self    |

### Transforms

| Property          | Type                                      | Description                                                      |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `rotate`          | `AngleValue`                              | Rotation, e.g. `Angle.Deg(45)`                                   |
| `scale`           | `number \| [number, number]`             | Uniform or `[x, y]` scale                                        |
| `translate`       | `LengthValue \| [LengthValue, LengthValue]` | Translation offset                                            |
| `transformOrigin` | `TransformOriginValue`                    | Origin point, e.g. `TransformOrigin.At(Length.Pct(50), Length.Pct(50))` |

### Typography

| Property     | Type              | Description                                           |
| ------------ | ----------------- | ----------------------------------------------------- |
| `color`      | `string`          | Text color (inherits)                                 |
| `fontSize`   | `PxLength`        | Font size in pixels (inherits)                        |
| `fontFamily` | `string`          | Font family (inherits)                                |
| `fontWeight` | `FontWeightValue` | `FontWeight.Light`, `Normal`, or `Bold` (inherits)    |
| `fontStyle`  | `FontStyleValue`  | `FontStyle.Normal`, `Italic`, or `Oblique` (inherits) |
| `lineHeight` | `number`          | Line height multiplier (inherits)                     |
| `textAlign`  | `TextAlignValue`  | `TextAlign.Left`, `Center`, or `Right` (inherits)     |
| `whiteSpace` | `WhiteSpaceValue` | `WhiteSpace.Normal` or `PreWrap` (inherits)           |

> Properties marked _(inherits)_ cascade down through the tree, just like CSS.

### Decoration

| Property          | Type                                 | Description                                        |
| ----------------- | ------------------------------------ | -------------------------------------------------- |
| `backgroundColor` | `string`                             | Fill color                                         |
| `borderRadius`    | `PxLength`                           | Corner radius                                      |
| `borderStyle`     | `BorderStyleValue`                   | `BorderStyle.Solid`, `Dashed`, `Dotted`, or `None` |
| `borderWidth`     | `PxLength`                           | Border line width                                  |
| `borderColor`     | `string`                             | Border color                                       |
| `boxShadow`       | `BoxShadowValue \| BoxShadowValue[]` | Drop or inset shadows                              |
| `opacity`         | `number`                             | `0`–`1`                                            |
| `clipPath`        | `string`                             | SVG path string for clipping                       |
| `pointerEvents`   | `PointerEventsValue`                 | `PointerEvents.Auto` or `None`                     |

## Length Values

Use the `Length` factory to create dimension values:

```ts
import { Length } from 'retend-canvas-2d';

Length.Px(16); // 16 pixels
Length.Pct(50); // 50% of parent
Length.Vw(100); // viewport width units (see renderer viewport)
Length.Vh(100); // viewport height units (see renderer viewport)
Length.FitContent; // shrink-wrap children
Length.Lh(1); // multiples of computed line height (font size × line height)
```

## Animations

Define keyframe animations and assign them via the `animationName` style property:

```tsx
import { Length, Angle, AnimationFillMode } from 'retend-canvas-2d';

const spin = {
  from: { rotate: Angle.Deg(0) },
  to: { rotate: Angle.Deg(360) },
};

<circle
  style={{
    width: Length.Px(60),
    height: Length.Px(60),
    backgroundColor: 'coral',
    animationName: spin,
    animationDuration: 1000, // ms
    animationIterationCount: Infinity,
    animationTimingFunction: [0, 0, 1, 1], // cubic-bezier
  }}
/>;
```

### Transitions

```tsx
import { Cell } from 'retend';
import { Length } from 'retend-canvas-2d';

const hovered = Cell.source(false);
const hoverBg = Cell.derived(() => (hovered.get() ? '#6366f1' : '#4f46e5'));
const hoverScale = Cell.derived(() => (hovered.get() ? 1.05 : 1));

<rect
  style={{
    width: Length.Px(120),
    height: Length.Px(40),
    backgroundColor: hoverBg,
    scale: hoverScale,
    transitionProperty: ['scale', 'backgroundColor'],
    transitionDuration: 200,
    transitionTimingFunction: [0.4, 0, 0.2, 1],
  }}
  onPointerMove={() => hovered.set(true)}
  onPointerUp={() => hovered.set(false)}
/>;
```

Animatable properties: `opacity`, `scale`, `rotate`, `translate`, `left`, `top`.

## Pointer Events

Nodes support `onClick`, `onPointerDown`, `onPointerMove`, and `onPointerUp`. Hit testing uses a second canvas buffer that encodes node IDs into pixel colors. That buffer is only allocated when **at least one** node has a pointer handler. The hit pass shares the same transform/clip stack as the visible frame, but **only nodes with handlers** (and `pointerEvents` not set to `None`) write ID-colored pixels; other shapes are “transparent” in hit space so picks can reach targets underneath.

```tsx
<rect
  style={{ width: Length.Px(100), height: Length.Px(100) }}
  onClick={(e) => {
    console.log('clicked at', e.x, e.y);
    e.stopPropagation();
  }}
  onPointerDown={(e) => {
    e.target.setPointerCapture(e.pointerId);
  }}
/>
```

## Particles

Render thousands of points efficiently using the `<particles>` element:

```tsx
import { CanvasParticlesProps } from 'retend-canvas-2d';

const positions = new Float32Array([10, 20, 50, 80, 120, 40]); // [x0,y0, x1,y1, ...]
const colorMap = ['red', 'green', 'blue'];

<particles
  positions={positions}
  colorMap={colorMap}
  sizeMap={4} // uniform size, or Float32Array for per-particle sizes
  shape="circle" // 'circle' | 'rect'
  style={{ width: Length.Pct(100), height: Length.Pct(100) }}
/>;
```

## Images

```tsx
<img
  src="https://example.com/photo.jpg"
  style={{
    width: Length.Px(200),
    height: Length.Px(150),
    borderRadius: Length.Px(8),
  }}
/>
```

> SVG sources are not supported. Use a rasterized format (PNG, JPEG, WebP, etc.).

## API Reference

### `connectToWorkerContext(canvas, worker)` — import from `retend-canvas-2d/main`

Transfers canvas control to the given worker and forwards pointer events. Returns a `RendererRef` with a `resize(width, height)` method.

### `setupWorkerContext(App, options?)` — import from `retend-canvas-2d/worker`

Bootstraps the renderer inside a Web Worker. `App` must be a zero-argument function that returns a JSX template (`() => JSX.Template`), same as for `renderToCanvasContext`. The optional `options.onInit` callback runs after the first render.

### `renderToCanvasContext(ctx, App)` — import from `retend-canvas-2d`

Renders `App` directly into the provided 2D context (`App` must be `() => JSX.Template`). Runs setup effects, then calls `drawToScreen()` once so the first frame is visible. Returns the `CanvasRenderer` instance. This still requires a real `CanvasRenderingContext2D` or `OffscreenCanvasRenderingContext2D` (for example `node-canvas` in Node if you emulate a canvas); it is not a string/HTML SSR API.

## Style Enums

```ts
import {
  Alignment, // Start | Center | End
  AnimationFillMode, // None | Forwards | Backwards | Both
  BorderStyle, // None | Solid | Dashed | Dotted
  BoxShadow, // BoxShadow.Drop(...) | BoxShadow.Inset(...)
  FontStyle, // Normal | Italic | Oblique
  FontWeight, // Light (200) | Normal (400) | Bold (700)
  Overflow, // Visible | Hidden
  PointerEvents, // Auto | None
  TextAlign, // Left | Center | Right
  WhiteSpace, // Normal | PreWrap
} from 'retend-canvas-2d';
```

## TypeScript & JSX Configuration

Keep Retend as the JSX runtime, and load the canvas intrinsic-element types from `retend-canvas-2d` (the package’s `jsx-runtime` entry only augments types and ships a stub runtime module — it does not replace `retend`’s JSX factory):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "retend",
    "types": ["retend-canvas-2d/jsx-runtime"]
  }
}
```

Import the augment once in your app (or in each TS entry that uses `<rect>` / `<text>` / etc.):

```ts
import 'retend-canvas-2d/jsx-runtime';
```

## License

MIT

# Native elements

The intrinsic tags are `div`, `button`, `input`, `textarea`, `img`, `svg`, `audio`, and `anchored`. The `audio` element is nonvisual: pass a local `src` with optional `autoPlay`, `loop`, `muted`, and `volume`, and call `play()` or `pause()` on a ref. Enabling `autoPlay` on an idle clip starts it; use `play()` to resume one you paused. Toggling `loop` does not restart playback. It emits `ended` and `error`. Text is ordinary JSX children, not a `<text>` tag. `img` accepts local or HTTP(S) sources; `svg` supports monochrome inline SVG or local SVG assets. `anchored` positions floating layers relative to their parent or to an explicit `{ x, y }` point.

```tsx
import { Cell } from 'retend';

export default function App() {
  const clicks = Cell.source(0);
  return <div style={{ padding: 24, gap: 12 }}>
    <div>Clicks: {clicks}</div>
    <button onClick={() => clicks.set(clicks.get() + 1)}>Count</button>
    <input placeholder="Name" style={{ width: 240 }} />
  </div>;
}
```

Properties can be Cells. `ref` provides native element objects with focus, scroll and measurement methods. Native input refs support selection APIs. No `innerHTML`, DOM layout API, or CSS selectors exist.

API: https://retend.dev/docs/gpui-elements

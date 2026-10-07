# retend-gpui issues found while building Deepfield

Deepfield (`~/Documents/Projects/deepfield`) is a native photo viewer built on `retend-gpui@0.0.36`. These are the gaps and rough edges hit while building it, roughly in order of how much they affected the app. Each lists the workaround used, so it's clear what the app is papering over.

## Rendering and input

### 0. `borderWidth` / `borderColor` don't paint

A `div` with `borderWidth: 2, borderColor: '#ff0000'` shows no border at all, with or without transforms on it or its ancestors, while `backgroundColor` and `borderRadius` on the same node render. GPUI itself paints borders (`Style::paint` → `is_border_visible()`), and `style.rs` maps `BorderWidth` to `.border(px)` and `BorderColor` to `.border_color(rgba)`, so the value is likely lost between the JS style publish and the element (or the prebuilt `retend-gpui-native-darwin-arm64@0.0.36` binary is out of date with the source).

- **Workaround:** rims are drawn by wrapping an element in a padded parent whose background is the rim colour; the selection ring is four 3px bars.

### 1. No wheel / scroll-wheel event

There is no `onWheel`. Only `onScroll` exists, and it only fires for `overflow: auto | scroll` containers, reporting offsets rather than deltas.

- **Impact:** wheel-to-zoom, canvas panning, sliders driven by the wheel, etc. are impossible directly.
- **Workaround:** the viewer renders an invisible 200,000 × 200,000 px scroll container over the image, starts it at the centre, and converts offset changes into deltas (`source/components/viewer/InputSurface.tsx`).
- **Suggested fix:** expose GPUI's `ScrollWheelEvent` as `onWheel` with `deltaX/deltaY`, `deltaMode` (pixels vs lines), `clientX/clientY`, modifiers, and touch phase (so momentum can be distinguished).

### 2. Scrollbars can't be hidden

`overflow: scroll` maps to `ScrollbarMode::Always` and `overflow: auto` to `ScrollbarMode::Scrolling` (`native/src/render.rs`, around the `ScrollbarOverlay` match). There is no way to scroll without a scrollbar.

- **Workaround:** the invisible scroll container is oversized by 40 px on every side so its scrollbars fall outside the window.
- **Suggested fix:** a `scrollbarWidth: 'none'` (CSS name) or `scrollbar: 'hidden' | 'auto' | 'always'` style.

### 3. Window paints white before the app renders

`root_container()` in `native/src/render.rs` hard-codes `.bg(gpui::rgb(0xffffff))`. Dark apps flash white at launch and on every full reload in dev.

- **Workaround:** none possible from JS. (Advice for recording demos: start after the window is up.)
- **Suggested fix:** a `backgroundColor` window option (and/or follow the system appearance), applied to the root container before the first JS frame.

### 4. No window vibrancy / translucency

`WindowOptions.window_background` is never set (`native/src/platform.rs`, `open_window`), so `WindowBackgroundAppearance::Blurred` / `Transparent` are unreachable.

- **Impact:** no translucent sidebars or toolbars, which is the single most recognisable trait of a macOS app.
- **Suggested fix:** `system.windowBackground: 'opaque' | 'transparent' | 'blurred'` (or per window), plus `transparent` actually being transparent at the root.

### 5. Traffic-light position is fixed

`titlebar.traffic_light_position` is never set. With `transparentTitlebar`, apps with a taller unified toolbar (52 px, as in Finder/Photos) can't vertically centre the traffic lights in it.

- **Workaround:** Deepfield squeezes its toolbar into 30 px.
- **Suggested fix:** `system.trafficLightPosition: { x, y }`.

### 6. No window drag regions

With a transparent titlebar, content covers the titlebar and there is no way to mark an element as a drag handle (`window.start_window_move()` is not exposed).

- **Suggested fix:** an element prop such as `windowDrag` / `-webkit-app-region: drag` equivalent, or `window.startMove()` callable from `onMouseDown`.

### 7. Cursor styles implemented

The `cursor` style property now maps to GPUI's native `CursorStyle`, including `pointer`, `grab`, `grabbing`, and `ew-resize`. The installed GPUI version does not support `zoom-in` or `zoom-out` cursors.

### 8. No gradients, shadows or backdrop blur in styles

No `backgroundImage: linear-gradient(...)`, `boxShadow`, or `backdropFilter`. GPUI supports gradients (`linear_gradient`) and shadows (`BoxShadow`) natively.

- **Workaround:** gradient scrims, the vignette and the viewer glow are pre-rendered PNG/JPEGs (`scripts/build-assets.mjs`).

### 9. Pointer transparency implemented

Use `pointerEvents: 'none'` to let pointer input pass through an element without hiding it. The value is inherited, but descendants can opt back in with `'auto'`. Their events propagate through disabled ancestors, which also retain ancestor hover and enter/leave behavior.

### 10. Native app menu is bare

`cx.set_menus([Menu::new(app_name)])` in `native/src/platform.rs` installs an empty app menu. There's no API for menu bar items, keyboard shortcuts in menus, or context menus.

## Assets and packaging

### 11. Root-relative asset paths follow Vite's `public/` convention

Root-relative paths now resolve against the resolved Vite `publicDir` in development (falling back to the Vite root when the public directory is disabled), and macOS packaging copies `publicDir` into `Contents/Resources`, beside the imported `assets/` directory. The production asset base also prefers `Contents/Resources` whenever it exists, so public-only apps resolve correctly.

## Scaffold (`retend-start --target=gpui`)

### 12. `tsconfig.json` lacks Node types

The template's `types` is `["retend-gpui/jsx-runtime"]`, but `application.ts` runs in Node and `@types/node` is already a dev dependency. Importing `node:fs` in the application class fails typechecking until `"node"` is added.

### 13. `.gitignore` has no trailing newline

Appending to it produces `.DS_Store.cache`.

### 14. The documented command is still interactive

`npx retend-start@latest my-app --target=gpui` (in `docs/content/29-gpui-overview.mdx`) still prompts for language and the `.docs` folder. Either document `--default`, or default the remaining answers when `--target` is given.

### 15. The AI `.docs` folder has no GPUI material

`--docs` copies web-oriented references (`web-setup.md`, DOM components) but nothing about GPUI elements, styles, events or windows, so an assistant working in a GPUI project has to find `docs/content/29-34` on its own.

## Smaller notes

- **One transition timing per element.** Because `transitionDuration` applies to every listed property, an element that needs a slow position change and a fast opacity change must be split into nested wrappers. CSS allows comma-separated per-property durations; supporting arrays aligned with `transitionProperty` would remove a lot of wrapper divs.
- **No keyframe animations.** Anything looping (a shimmer, a spinner) has to be driven by timers setting Cells.
- **Dev process output isn't visible** when `retend-gpui dev` is started from a non-TTY process (e.g. an agent or task runner): the log file stayed empty, so `console.log` from components was invisible. Deepfield debugged by appending to a file.

# Retend GPUI motion decisions

This document records accepted API-design decisions for transitions and animations in `retend-gpui`. It describes the target public model, not necessarily the prototype's current implementation.

## Renderer ownership

Motion APIs are renderer-specific. Retend core does not need to define a single cross-renderer transition or animation type, and individual renderers remain free to support different animatable properties and implementation strategies.

That freedom should not produce unrelated interaction models. `retend-gpui` and `retend-canvas-2d` should both use the web platform's CSS transitions and animations as their mental model.

## Style-driven motion

Transitions and animations belong to the element's style vocabulary. Ordinary style changes are what trigger transitions; applications should not need a separate declarative `initial` / `animate` state model.

The current GPUI `motion` prop and its `GpuiMotionProps` shape are therefore not the target public API. GPUI motion should instead be expressed through style properties analogous to CSS and to the existing `retend-canvas-2d` precedent.

For example, the intended transition shape is conceptually:

```tsx
<div
  style={{
    opacity,
    transitionProperty: 'opacity',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
  }}
/>
```

A transition begins when the styled property's resolved value changes.

## Transitions

Use CSS-style transition longhands as the public API rather than a custom transition object or shorthand string parser.

The expected vocabulary includes:

- `transitionProperty`
- `transitionDuration`
- `transitionTimingFunction`
- `transitionDelay`

`transitionProperty` accepts only explicit GPUI property names. Do not support the CSS `all` keyword. If `transitionProperty` is omitted, no properties transition; transitions are explicitly opt-in, matching `retend-canvas-2d`. Duplicate property names are harmless and are deduplicated internally rather than treated as errors.

Transition durations and delays use CSS-style string values rather than numeric millisecond values. Support both CSS time units, for example `'200ms'` and `'0.2s'`. Parse time strings by trimming surrounding whitespace, removing the `ms` or `s` suffix, and passing the numeric portion through `Number()` rather than maintaining a stricter decimal grammar. Equivalent numeric forms such as `'.2s'` and `'0.20s'` are therefore accepted. Empty or non-finite numeric values are invalid and fail soft. Negative durations are invalid and fail soft; negative delays are clamped to `0ms`. Omitted transition longhands use CSS defaults: `transitionDuration: '0s'`, `transitionDelay: '0s'`, and `transitionTimingFunction: 'ease'`. A zero duration does not bypass a nonzero delay: the style change waits for the delay, then applies the new value without interpolation. The native layer may normalize these values once when declarations change; animation interpolation remains native rather than running frame-by-frame in JavaScript.

Transition and animation timing functions use CSS-style string values. Support the standard named curves such as `'linear'`, `'ease'`, `'ease-in'`, `'ease-out'`, and `'ease-in-out'`, as well as CSS `cubic-bezier(...)` values.

For the initial implementation, the animatable-property set is limited to what GPUiX's existing native motion bridge already supports: `width`, `height`, `top`, `right`, `bottom`, `left`, `opacity`, and `borderRadius`. Do not extend `@gpuix/native` as part of this work. Broader GPUI animation support can be reconsidered separately later.

Follow the existing `retend-canvas-2d` convention for transitioning multiple properties: `transitionProperty` may be a single explicit animatable GPUI property name or an array of explicit property names. `transitionDuration`, `transitionDelay`, and `transitionTimingFunction` remain single shared values rather than parallel per-property lists.

Interrupted transitions restart from the element's currently rendered/interpolated value rather than from the previous declared target. A new style change during an active transition therefore continues smoothly from the visible state, matching browser CSS transition behavior.

If a declared transition cannot be represented by GPUiX's current native motion layer for the actual endpoint values, Retend GPUI applies the new resolved style value immediately rather than throwing. For example, percentage-based or mixed percentage/pixel dimension changes should not attempt a transition while GPUiX only supports numeric pixel motion for those properties.

If a property is removed from `transitionProperty` while its transition is running, cancel that transition immediately and snap the property to its resolved style value.

Transition eligibility and configuration are determined from the new resolved style. If `transitionProperty` and related transition longhands are added in the same update that changes an animatable property, that property change should transition using the newly supplied transition settings, provided the element already had a previous rendered style. Initial mount still does not transition.

Reactive style updates are coalesced until the renderer commits the resolved style to the native rendering pipeline. Microtask boundaries are not semantic transition boundaries: multiple style changes across microtasks may still collapse into one after-change style if no renderer/native commit occurs between them. Transition eligibility and configuration are computed from that committed after-change style, so transport batching and listener ordering do not create observable intermediate transition targets. An explicit `renderer.flush()` forces this commit boundary and establishes the current resolved style before later changes are processed.

Initial render does not trigger transitions. Mounting establishes the element's initial resolved style immediately; transitions only begin on subsequent committed changes to properties named by `transitionProperty`, matching browser CSS behavior.

For `hover` pseudo-state styles, keep non-transitioned hover properties on GPUiX's native pseudo-state path. If a hover property is also named by `transitionProperty`, do not pass that property through the native `hover` style. Instead, install internal `mouseEnter` / `mouseLeave` handling that updates the transition target once at each hover boundary, while GPUiX's native motion engine performs the frame-by-frame interpolation. Internal hover handling must compose with user-provided mouse enter/leave handlers rather than replacing them.

Apply the same split-path rule to `active` pseudo-state styles. Keep non-transitioned active properties on GPUiX's native pseudo-state path. If an active property is named by `transitionProperty`, withhold it from the native `active` style and drive it through renderer-internal press/release handling that updates the transition target at those boundaries. Expose GPUI's native `mouse_up_out` event through GPUiX as `mouseUpOut` so a press that begins on the element and releases outside can clear synthesized active state correctly. `mouseUpOut` is also part of the normal public GPUI event surface as `onMouseUpOut`. Use `mouseUp` and `mouseUpOut` for release; do not approximate outside release with `mouseLeave`, because leaving while the pointer is still held should not end the active state. Renderer-internal active handling must compose with user-provided `onMouseUp` / `onMouseUpOut` and other mouse handlers rather than replacing them.

When multiple pseudo-states define the same transitioned property, Retend GPUI uses the explicit precedence `active > hover > base`. Pressing while hovered transitions from the hover value to the active value. Releasing while still inside transitions back to the hover value; releasing outside transitions back to the base value.

Nested values inside `hover` and `active` are reactive. Cells may drive pseudo-state property values as well as pseudo-state transition longhands, and updates participate in the same resolved-style commit/coalescing rules as top-level reactive styles. This intentionally expands the current GPUI style reactivity model rather than keeping pseudo-state objects static. If a reactive value inside the currently winning pseudo-state changes while that state remains active, treat it as a normal transitioned style change and retarget from the currently rendered/interpolated value to the new pseudo-state target. If a reactive value changes inside a pseudo-state that is not currently winning, update only that pseudo-state's stored future target and do not start a transition until the pseudo-state later becomes active.

`hover` and `active` pseudo-state styles may also override `transitionProperty`, `transitionDuration`, `transitionDelay`, and `transitionTimingFunction`. Transition eligibility and configuration are resolved from the winning after-change pseudo-state, so a property may become transition-enabled only in `hover` or `active`. Entry and exit may therefore use different property sets and timings, following the same after-change-style rule as ordinary transitions. If a pseudo-state change causes the newly winning `transitionProperty` to exclude a property that is currently transitioning, cancel that transition immediately and snap the property to the newly resolved state value, matching the ordinary transition-property removal rule.

If a transitioned property is removed from `style` entirely, cancel any active transition for that property and snap immediately to the renderer's resulting value. Do not attempt to synthesize a CSS-like computed default target for the removed property.

Transition lifecycle events such as `onTransitionRun`, `onTransitionStart`, `onTransitionEnd`, and `onTransitionCancel` are deferred from the initial API. Add them only when the native bridge can expose reliable lifecycle notifications.

## Animations

Keyframe animations are deferred from the initial GPUI motion implementation because the current GPUiX native motion bridge does not expose keyframe support and `retend-gpui` will not extend the native layer yet. The CSS-style animation API described below remains the intended future direction rather than part of the first implementation.

Use CSS-style animation longhands and keyframe definitions, following the same mental model already used by `retend-canvas-2d`.

The expected vocabulary includes:

- `animationName`
- `animationDuration`
- `animationTimingFunction`
- `animationDelay`
- `animationIterationCount`
- `animationFillMode`

Keep the initial animation surface aligned with the smaller `retend-canvas-2d` surface. Do not add other CSS animation longhands such as `animationDirection` or `animationPlayState` yet.

Animation iteration counts and fill modes use CSS-style string values where CSS does: for example, `'infinite'` for unbounded iteration and `'none'`, `'forwards'`, `'backwards'`, or `'both'` for fill mode. Finite iteration counts remain numeric.

When `animationName` changes while a keyframe animation is running, the replacement animation starts from the beginning of its own keyframes. It does not inherit or blend from the currently rendered/interpolated value of the previous animation.

Negative animation delays are not supported. If `animationDelay` resolves to a negative duration, clamp it to `0ms` rather than applying CSS's negative-delay behavior.

If `animationName` stays the same but another animation longhand changes, follow web CSS animation semantics: update the running animation without restarting its timeline. Preserve its playback time and recompute progress under the new duration, delay, timing function, iteration count, or fill mode, even when that produces a visible jump.

`animationName` should refer to a keyframe definition rather than to an `initial` / `animate` pair. Keyframes use the same public object shape as `retend-canvas-2d`, with web-familiar selectors such as `from`, `to`, and percentage-string keys like `'50%'`.

If a keyframe animation and a transition both target the same property, the active keyframe animation takes precedence and the transition for that property is suppressed, matching `retend-canvas-2d`.

For example:

```tsx
const fadeIn = {
  from: { opacity: 0 },
  to: { opacity: 1 },
};

<div
  style={{
    animationName: fadeIn,
    animationDuration: '200ms',
  }}
/>
```

Invalid transition declarations fail soft, matching web CSS behavior. Malformed duration, delay, or timing-function values such as `transitionDuration: 'banana'` or an invalid `cubic-bezier(...)` should be ignored for transition purposes rather than throwing; the underlying resolved style change still applies immediately.

## Longhands first

Longhand properties are the API. Do not introduce `transition` or `animation` shorthand parsing as part of the initial design.

This preserves the web mental model without requiring GPUI to parse CSS strings, and it matches the established `retend-canvas-2d` direction.

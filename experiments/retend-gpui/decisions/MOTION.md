# Retend GPUI motion decisions

This document records accepted API-design decisions for transitions and animations in `retend-gpui`. The transition sections describe the implemented v1 model; keyframe animations remain the intended future direction described later in this document.

## Renderer ownership

Motion APIs are renderer-specific. Retend core does not need to define a single cross-renderer transition or animation type, and individual renderers remain free to support different animatable properties and implementation strategies.

That freedom should not produce unrelated interaction models. `retend-gpui` and `retend-canvas-2d` should both use the web platform's CSS transitions and animations as their mental model.

The v1 transition adapter is Rust-owned but playback is GPUI-owned. JavaScript commits resolved base, `hover`, and `active` author-style snapshots; Rust parses the CSS-style transition declarations and resolves the winning author target. During rendering, only transition-eligible `(node, property)` targets are passed to GPUI Base's keyed `motion::transition` primitive. GPUI Base owns the presentation value, timing state, interpolation, target retargeting/reversal, animation-frame scheduling, and reduced-motion behavior. Retend keeps only a lightweight per-node record of the last rendered author targets and eligible-property mask so a newly enabled channel can be seeded from the previous committed target without keeping GPUI transition state alive for static nodes. Retend does not keep a parallel animation clock or per-frame presentation state, and no animation-frame traffic crosses to JavaScript.

## Style-driven motion

Transitions and animations belong to the element's style vocabulary. Ordinary style changes are what trigger transitions; applications should not need a separate declarative `initial` / `animate` state model.

Retend GPUI does not expose a separate `motion` prop or `GpuiMotionProps` shape. Motion is expressed through style properties analogous to CSS and to the existing `retend-canvas-2d` precedent.

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

Transition durations and delays use CSS-style string values rather than numeric millisecond values. Support both CSS time units, for example `'200ms'` and `'0.2s'`. Parse time strings by trimming surrounding whitespace, removing the `ms` or `s` suffix, and passing the numeric portion through `Number()` rather than maintaining a stricter decimal grammar. Equivalent numeric forms such as `'.2s'` and `'0.20s'` are therefore accepted. Empty or non-finite numeric values are invalid and fail soft. Negative durations are invalid and fail soft; negative delays are clamped to `0ms`. Omitted transition longhands use CSS defaults: `transitionDuration: '0s'`, `transitionDelay: '0s'`, and `transitionTimingFunction: 'ease'`. A zero duration does not bypass a nonzero delay: the style change waits for the delay, then applies the new value without visible interpolation. Rust normalizes the author-facing strings into a GPUI Base transition policy; GPUI Base executes the delay/easing and schedules playback natively rather than JavaScript running frames.

Transition and animation timing functions use CSS-style string values. Support the standard named curves such as `'linear'`, `'ease'`, `'ease-in'`, `'ease-out'`, and `'ease-in-out'`, as well as CSS `cubic-bezier(...)` values.

For the initial implementation, the Retend GPUI adapter exposes `width`, `height`, `top`, `right`, `bottom`, `left`, `opacity`, and `borderRadius` through GPUI Base's keyed value-transition primitive. Broader GPUI motion support can be surfaced separately later without introducing a parallel Retend playback engine.

Follow the existing `retend-canvas-2d` convention for transitioning multiple properties: `transitionProperty` may be a single explicit animatable GPUI property name or an array of explicit property names. `transitionDuration`, `transitionDelay`, and `transitionTimingFunction` remain single shared values rather than parallel per-property lists.

Interrupted transitions restart from the element's currently presented value rather than from the previous declared target. GPUI Base owns that presentation value and samples it when a keyed target changes, so Retend does not mirror the current visible value in its retained tree.

If a declared transition cannot be represented by the current GPUI transition adapter for the actual endpoint values, Retend GPUI applies the new resolved style value immediately rather than throwing and resets that keyed transition channel. For example, percentage-based or mixed percentage/pixel dimension changes fall back to an immediate update while the v1 adapter exposes numeric pixel interpolation for those properties.

If a property is removed from `transitionProperty` while its transition is running, cancel that transition immediately and snap the property to its resolved style value.

Transition eligibility and configuration are determined from the new resolved style. If `transitionProperty` and related transition longhands are added in the same update that changes an animatable property, that property change should transition using the newly supplied transition settings, provided the element already had a previous rendered style. Initial mount still does not transition.

Reactive style updates are coalesced until the renderer commits the resolved style to the native rendering pipeline. Microtask boundaries are not semantic transition boundaries: multiple style changes across microtasks may still collapse into one after-change style if no renderer/native commit occurs between them. Transition eligibility and configuration are computed from that committed after-change style, so transport batching and listener ordering do not create observable intermediate transition targets. An explicit `renderer.flush()` forces this commit boundary and establishes the current resolved style before later changes are processed.

Initial render does not trigger transitions. GPUI Base's keyed transition primitive adopts the first target immediately; transitions begin only when a later committed target changes for a property named by `transitionProperty`.

Retend GPUI automatically respects the application's reduced-motion preference. When GPUI reports reduced motion, keyed transitions snap to their resolved targets instead of animating; applications do not need to reimplement this policy in JavaScript.

`hover` and `active` pseudo-state resolution is native-owned. GPUI owns pointer hit testing and outside-release detection; Rust mirrors only the current hover/pressed selection needed to resolve the winning author-style target during render. GPUI Base then applies or retargets the same keyed property transition channels used for ordinary style changes. The mirror exists because GPUI's style-refinement pseudo-state is not exposed as a render-time target value for `motion::transition`; Retend does not perform a second hit-test or pointer-tracking system. JavaScript does not synthesize pseudo-state transitions from user event handlers, so internal interaction state cannot conflict with application listeners.

When multiple pseudo-states define the same transitioned property, Retend GPUI uses the explicit precedence `active > hover > base`. Pressing while hovered transitions from the hover value to the active value. Releasing while still inside transitions back to the hover value; releasing outside transitions back to the base value.

Nested values inside `hover` and `active` are reactive. Cells may drive pseudo-state property values as well as pseudo-state transition longhands, and updates participate in the same resolved-style commit/coalescing rules as top-level reactive styles. This intentionally expands the current GPUI style reactivity model rather than keeping pseudo-state objects static. If a reactive value inside the currently winning pseudo-state changes while that state remains active, treat it as a normal transitioned style change and retarget from the currently rendered/interpolated value to the new pseudo-state target. If a reactive value changes inside a pseudo-state that is not currently winning, update only that pseudo-state's stored future target and do not start a transition until the pseudo-state later becomes active.

`hover` and `active` pseudo-state styles may also override `transitionProperty`, `transitionDuration`, `transitionDelay`, and `transitionTimingFunction`. Transition eligibility and configuration are resolved from the winning after-change pseudo-state, so a property may become transition-enabled only in `hover` or `active`. Entry and exit may therefore use different property sets and timings, following the same after-change-style rule as ordinary transitions. If a pseudo-state change causes the newly winning `transitionProperty` to exclude a property that is currently transitioning, cancel that transition immediately and snap the property to the newly resolved state value, matching the ordinary transition-property removal rule.

If a transitioned property is removed from `style` entirely, cancel any active transition for that property and snap immediately to the renderer's resulting value. Do not attempt to synthesize a CSS-like computed default target for the removed property.

Transition lifecycle events use native notifications with CSS-style names. `onTransitionRun` fires when a transition is created for a newly eligible target change, `onTransitionStart` fires when its delay elapses and interpolation begins (immediately after run when there is no delay), `onTransitionEnd` fires once when interpolation completes, and `onTransitionCancel` fires when an active transition is retargeted, removed, or forced to snap by reduced motion. Each event carries the author-facing `propertyName` (for example `'opacity'` or `'borderRadius'`) and `elapsedTime` in seconds (`0` for run/cancel, the configured delay for start, and the configured duration for end). Events bubble through the Retend logical tree like other native events and are only delivered while a matching listener subscription exists. Initial mount, immediate zero-duration snaps, reduced-motion snaps with no open lifecycle, unsupported (non-pixel) endpoints, and invalid transition declarations do not emit lifecycle events. A zero-duration transition with a positive delay still has a delayed lifecycle: it emits run, then start and end when the delay expires.

## Animations

Keyframe animations are deferred from the initial GPUI motion implementation. The CSS-style animation API described below remains the intended future direction rather than part of the first transition-engine implementation.

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

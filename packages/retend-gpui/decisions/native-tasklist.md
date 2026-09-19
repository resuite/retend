# Native Bridge Task List

This task list implements the architecture defined in `NATIVE.md`. Work is divided into four phases with explicit completion gates so each phase leaves the bridge in a coherent, testable state.

## Phase 1 — Protocol, Native Tree, and Runtime Foundation

Goal: establish the JS/Rust boundary, authoritative Rust tree, renderer/window binding, settlement semantics, and native process/runtime integration before adding higher-level UI behavior.

### Native package and distribution

- [x] Create the Retend-owned Rust N-API addon package.
- [x] Set up per-platform prebuilt package structure and loading from the JavaScript package.
- [x] Define platform build targets for macOS, Linux, and Windows.
- [x] Keep the bridge API private to `retend-gpui` rather than exposing a GPUiX-compatible public API.
- [x] Add a protocol version constant shared by TypeScript and Rust.

### Binary protocol

- [x] Define the command-batch header and protocol version encoding.
- [x] Define one authoritative machine-readable schema for opcode, element-kind, property, and native-event numeric IDs.
- [x] Generate matching TypeScript and Rust constants/enums from that ID schema.
- [x] Define fixed `u32` encoding for node IDs and string-table indexes.
- [x] Implement batch-local string-table encoding.
- [x] Implement JavaScript command-buffer writer utilities.
- [x] Implement Rust command-buffer decoder utilities.
- [x] Implement bounds checking and corrupt-buffer detection in Rust.
- [x] Reject unsupported protocol versions synchronously.
- [x] Keep semantic author strings as strings in the command batch; do not add a JavaScript CSS-style parser.

### Command host

- [x] Replace direct native mutation calls with a renderer-local pending command queue.
- [x] Preserve one-microtask batching for synchronous mutations.
- [x] Implement explicit synchronous `flush()`.
- [x] Ensure each renderer command batch is implicitly bound to exactly one native window.
- [x] Ensure multi-window updates become independent per-window command batches.
- [x] Preserve transport ordering without public batch revision numbers.
- [x] Make `applyCommandBatch(buffer)` synchronous for decode and ordered retained-tree mutation.

### Node identity and authoritative tree

- [x] Add one process-scoped JavaScript `u32` node-ID allocator.
- [x] Ensure IDs are monotonically increasing and never reused during the process lifetime.
- [x] Implement the process-wide Rust node arena.
- [x] Implement immutable per-window root node IDs.
- [x] Enforce one-window-for-life ownership for every native node.
- [x] Reject cross-window reparenting.
- [x] Reserve protocol element kinds for container, text, image, input, and textarea; instantiate retained variants in the phase that owns each element's native state.
- [x] Keep GPUI element instances out of the authoritative retained tree.

### Structural mutations and settlement

- [x] Implement create/insert/remove/reorder/update operations against the Rust retained tree.
- [x] Decode the complete command batch before mutating retained state.
- [x] Validate every command completely before that command mutates retained state.
- [x] Retain successfully applied command prefixes when a later command fails.
- [x] Implement pending-detached root tracking in Rust.
- [x] Remove a node from pending-detached tracking when reinserted.
- [x] Keep detached nodes fully mutable before settlement.
- [x] Ensure newly created never-attached nodes are not automatically pending-detached.
- [x] Implement native `settle()`.
- [x] Make `host.settle()` flush pending UI mutations before native settlement.
- [x] Recursively destroy still-detached subtrees during native settlement.
- [x] Destroy associated native runtime state during settlement without JavaScript enumerating dead IDs.
- [x] Flatten JavaScript groups at insertion time rather than creating native group nodes.
- [x] Keep Retend groups and range anchors JavaScript-only and project them out when synchronizing native children.

### Fatal bridge path

- [x] Define structured native bridge-failure payloads.
- [x] On command/invariant failure, preserve the valid prefix, leave the failing command unapplied, and poison the affected native window before releasing the retained-tree lock.
- [x] On wire-format failure, poison the affected native window without mutating retained state.
- [x] Catch native bridge failures at the JS renderer/host boundary.
- [x] Capture the JavaScript stack for fatal renderer bugs.
- [x] Mark the affected Rust window renderer state fatal after a hard bridge failure.
- [x] Implement the dedicated out-of-band fatal diagnostic command.
- [x] Implement a native fatal diagnostic surface for a poisoned renderer/window.
- [x] Reject later normal renderer mutations in Rust while that window's renderer state remains fatal.
- [x] Keep semantic style-value parse failures out of the fatal bridge path.

### Fatal root lifecycle

- [x] Treat a fatal native bridge failure as failure of the current window's Retend root, not of the process-wide application, native window, `GpuiHost`, or renderer object.
- [x] Keep fatal/poison state authoritative in Rust only; do not mirror it or cache the fatal failure as lifecycle state in JavaScript.
- [x] After Rust returns the structured failure, capture the JavaScript stack and send it back through the dedicated fatal diagnostic path.
- [x] Discard the current JavaScript root wholesale without submitting cleanup/removal commands to the fatal Rust renderer state.
- [x] Dispose the failed root's Retend state branch, effects, Cell-owned subscriptions, refs, logical nodes, and pending renderer cleanup work.
- [x] Keep the process-wide `GpuiApplication`, unrelated windows, the affected native window, `GpuiHost`, and renderer object alive while the native fatal diagnostic surface is shown.
- [x] On native Reload, reset that window's fatal Rust renderer state in place, then rerun the same window entry/root component to create a fresh Retend root and fresh root state/effects.
- [x] Do not reinitialize or replace the process-wide `GpuiApplication` when reloading a single failed window root.
- [x] Let any stale post-failure native work be rejected by Rust rather than maintaining a duplicate JavaScript poison guard.
- [x] Add lifecycle tests covering root/reactive teardown, cleanup-command discard, partial-render recovery, Rust cross-window isolation and stale-reload rejection, native Reload signal delivery, and closed-window classification.

### Platform runtime and windows

- [x] Implement the native GPUI application singleton and window registry.
- [x] Implement macOS main-thread GPUI/AppKit integration.
- [x] Implement or preserve the required macOS event-loop tick/pump integration.
- [x] Implement Windows/Linux native UI-thread execution where required by GPUI.
- [x] Keep the public JS/native ordering semantics identical across platform topologies.
- [x] Implement renderer-to-window binding handles.
- [x] Implement native window creation and close.
- [x] Closing a window destroys its retained subtree and invalidates its renderer binding.
- [x] Reject any later command batch sent through a closed-window renderer.
- [x] Add deliberate Node process keep-alive ownership while native windows exist.
- [x] Release the final keep-alive only after application teardown completes.

### Phase 1 tests

- [x] Add focused TypeScript encoder tests for the Phase 1 command layouts without freezing the complete protocol as a permanent golden-byte suite.
- [x] Add Rust decoder tests for malformed buffers, invalid indexes, unknown opcodes, invalid node references, and unsupported versions.
- [x] Add Rust fuzz/property tests for command-batch decoding and command validation.
- [x] Add tests proving a failing command makes no partial mutation while earlier valid commands remain applied.
- [x] Add detached/reinsert/settle lifecycle tests, including nested detached roots.
- [x] Add process-global node-ID and cross-window ownership tests.
- [x] Add renderer poisoning tests.

### Phase 1 completion gate

- [x] A headless JS renderer can create, mutate, move, detach, reattach, settle, and destroy native nodes through the binary protocol.
- [x] Rust structural/command-failure tests cover the retained-tree behavior exercised by the headless JS renderer.
- [x] A real native window can be created and bound to a renderer on the primary development platform.
- [x] Hard failures poison only the affected renderer; wire failures mutate nothing and command failures retain only the valid prefix.

## Phase 2 — Rendering, Styles, Text, Events, and Multi-Window UI

Goal: make the Retend-owned bridge the normal renderer path for Retend GPUI, with `div`, text, images, styles, pointer/keyboard events, and independent native windows. Phase 3 must build on this renderer rather than on a parallel native test harness or the previous GPUiX path.

### GPUI render pipeline

- [x] Implement retained-tree-to-GPUI render traversal per window.
- [x] Construct a fresh GPUI element tree for each render.
- [x] Map stable Retend IDs to GPUI `ElementId`s for the Phase 2 elements that require persistent GPUI state; add IDs to later stateful container/control paths only when those features need them.
- [x] Keep GPUI-bound objects in the native execution context rather than in retained-tree data.
- [x] Invalidate the affected native window after each submitted batch so successful state renders and failures switch to the fatal diagnostic surface.
- [x] Add an observable binding-level render test proving one successful submitted batch produces one coherent native render update.

### Style schema and native parsing

- [x] Define the v1 property schema and numeric property IDs.
- [x] Define TypeScript authoring types for the supported Phase 2 static style surface.
- [x] Implement the generic tagged property-value wire shape for numbers, booleans, string-table references, and removal/null.
- [x] Keep property-specific semantics in Rust rather than creating property-specific binary layouts.
- [x] Implement Rust semantic parsers for Phase 2 keyword values.
- [x] Implement Rust percentage/length parsing.
- [x] Implement Rust color parsing.
- [x] Store parsed Retend-native values for supported Phase 2 styles during command application.
- [x] Implement fail-soft behavior for invalid semantic style values.
- [x] Send complete resolved author-style snapshots from JavaScript; declarations disappear by omission from the replacement snapshot rather than separate removal commands.
- [x] Keep GPUI defaults, Retend intrinsic defaults, and inherited/computed style out of JavaScript snapshots.
- [x] Implement block as the default `div` display behavior.
- [x] Make flex opt-in with `display: 'flex'`.
- [x] Preserve explicit Retend root background/text-color defaults.

### Basic intrinsic rendering

- [x] Implement `div` rendering.
- [x] Implement dedicated native text nodes.
- [x] Render native text nodes through GPUI `Text` with stable Retend-derived `ElementId`s.
- [x] Let GPUI own text shaping, wrapping, accessibility, and inherited text styling.
- [x] Coalesce adjacent text nodes into single inline GPUI `Text` runs at render time.
- [x] Render mixed text/element content as ordinary GPUI children in source order.
- [x] Implement `img` for HTTP(S) `src` URLs through GPUI image sources; bundled asset-path resolution remains owned by the later Vite asset pipeline.
- [x] Parse and apply the current image-specific `objectFit` authoring property natively.
- [x] Delegate loading, decoding, caching, intrinsic metadata, and rendering to GPUI's image/asset system.
- [x] Replace the GPUI image source on the next render when retained `src` changes, including clear/re-add transitions, while preserving the stable image `ElementId` and layout participation.
- [x] Keep image loading/animation/cache state GPUI-owned rather than duplicating node-owned image state in Retend.
- [x] Reject unsupported intrinsic tags with a descriptive render-time error.

### Native event transport

- [x] Define the static native event metadata table.
- [x] Implement structured Rust→JS N-API event delivery.
- [x] Include `targetId` derived from native hit testing.
- [x] Implement pointer payload fields: `clientX`, `clientY`, `button`, `buttons`, `detail`, modifiers, and `timeStamp`.
- [x] Implement native event subscription bookkeeping keyed by node ID/event type.
- [x] Make listener registration/removal effective synchronously for active nodes.
- [x] Flush pending insertion before synchronizing a listener on a logically active but not-yet-submitted node.
- [x] Coalesce `mousemove` latest-wins while delivery is pending.
- [x] Keep discrete native events ordered and uncoalesced.
- [x] Drop stale events whose target ID is destroyed or not currently presented in the native window when JS dispatch begins.

### Retend event dispatch

- [x] Implement Retend-owned `addEventListener`, `removeEventListener`, and `dispatchEvent` registry behavior.
- [x] Keep Retend nodes EventTarget-compatible without relying on built-in `EventTarget` inheritance.
- [x] Snapshot the complete propagation path before dispatch.
- [x] Snapshot each node's listener list before invoking that node.
- [x] Suppress listeners removed before their turn.
- [x] Exclude listeners added during the current node dispatch.
- [x] Implement capture, target, and bubble phases according to event metadata.
- [x] Implement non-bubbling `mouseenter` and `mouseleave` semantics.
- [x] Implement non-bubbling `focus`, `blur`, and element `scroll` semantics with their Phase 3 native sources.
- [x] Implement `stopPropagation()` and `stopImmediatePropagation()`.
- [x] Route listener exceptions through the normal Retend application/dev error path without poisoning the renderer.
- [x] Limit `preventDefault()` to Retend-side default actions; do not imply cancellation of already-completed native behavior.
- [x] Implement the `mousedownoutside` native extension.

### Window surface

- [x] Implement the current JavaScript window wrapper over its Retend-owned native binding/window ID.
- [x] Apply configured initial window width/height/title natively and implement native title updates.
- [x] Propagate native OS-window closure back to the JavaScript host lifecycle.
- [x] Push native resize events to JavaScript before exposing live width/height state.
- [x] Implement per-window focus/blur lifecycle events.
- [x] Implement `closeWithOpener` lifetime behavior.
- [x] Implement resizable state.
- [x] Implement fullscreen/maximized state.
- [x] Implement minimum-size constraints.
- [x] Implement maximum-size constraints using platform support where required.
- [x] Support multiple independent Retend roots/windows in one process.
- [x] Preserve native windows across Vite full reload according to `VITE.md`.

### Development root/error integration

- [x] Keep one immutable native root per window.
- [x] Mount application output directly beneath that root through a JavaScript-only logical root, without an implicit layout container.
- [x] Keep recoverable development UI renderer-owned outside the application's Retend tree.
- [x] Preserve the existing application subtree during recoverable compile/HMR errors while temporarily presenting the development overlay.
- [x] Remove the overlay after a successful update and restore the preserved application subtree.
- [x] Allow errors to render before the application entry has successfully mounted.

### Renderer migration

- [x] Port `gpui-renderer.ts` and its host mutation path onto `GpuiHost` and the Retend-owned command protocol.
- [x] Make normal Retend GPUI renderer/window creation use the Retend-owned native binding rather than the GPUiX native renderer.
- [x] Preserve permanent destroyed-node state, reactive cleanup, and ref cleanup on the migrated renderer; stale-event rejection is completed with native event dispatch.
- [x] Route the Phase 2 style, event, window, and development-overlay behavior through the migrated renderer rather than maintaining a second native-only implementation path.
- [x] Port the current Phase 2-capable README/native smoke examples to the v1 intrinsic/style surface and run the smoke path through the migrated renderer.
- [x] Ensure the renderer surface needed by Phase 3 extends this migrated path directly; do not keep a separate GPUiX renderer as the implementation target for focus, queries, scrolling, or text controls.
- [x] Leave only genuinely residual GPUiX compatibility/dead-code cleanup for Phase 4; no active normal renderer path depends on GPUiX.

### Phase 2 tests

- [x] Add renderer conformance tests for `div`, text nodes, mixed content, images, style removal, structural settlement, and HMR through the migrated Retend-owned renderer path.
- [x] Add native style parser tests, including fail-soft invalid values.
- [x] Add image source replacement tests.
- [x] Add event bubbling/non-bubbling tests.
- [x] Add listener snapshot/mutation-during-dispatch tests.
- [x] Add stale-event and mousemove-coalescing tests.
- [x] Add runtime-level multi-window isolation and Vite full-reload preservation tests.
- [x] Add native resize-event tests.

### Phase 2 completion gate

- [x] A normal Retend application renders styled `div`, text, and images in native windows through the Retend-owned bridge.
- [x] `gpui-renderer.ts` and the normal development/runtime renderer path use the Retend-owned command host and native binding for the implemented Phase 2 feature surface.
- [x] No active normal renderer path depends on GPUiX; Phase 3 can add stateful native capabilities directly to the migrated renderer.
- [x] Pointer events reach the correct Retend targets and propagate with the documented semantics.
- [x] Resizing and window lifecycle changes arrive through native events rather than polling.
- [x] Recoverable development errors render without replacing the immutable native root/window.

## Phase 3 — Focus, Queries, Scrolling, and Native Text Controls

Goal: add the stateful native capabilities that require persistent GPUI runtime objects and strict ordering between JavaScript commands and authoritative native state.

### Native runtime-state registry

- [x] Add per-node native runtime state keyed by stable node ID.
- [x] Persist GPUI `FocusHandle`s independently of ephemeral GPUI element instances.
- [x] Persist GPUI `ScrollHandle`s for scroll-container states.
- [x] Persist text-input editor state for `input`.
- [x] Persist text-input editor state for `textarea`.
- [x] Destroy associated runtime state during native settlement and window destruction.

### Imperative command/query framework

- [x] Implement node-bound native command methods.
- [x] Keep native-backed property getters out of the public API.
- [x] Implement synchronous submission ordering for native commands.
- [x] Reject commands immediately on permanently destroyed nodes.
- [x] Implement async native query transport.
- [x] Flush pending renderer mutations before every native query.
- [x] Order queries after all earlier native commands.
- [x] Add an internal per-window render/layout generation or fence.
- [x] Resolve layout queries only from a generation that includes all preceding submitted work.
- [x] Reject pending queries when the renderer/window closes or becomes poisoned.
- [x] Return neutral zeroed layout data for retained-but-detached nodes.

### Layout/query surface

- [x] Implement `await node.measure()`.
- [x] Return border-box `x`, `y`, `width`, and `height` in window coordinates.
- [x] Include `scrollWidth` and `scrollHeight`.
- [x] Implement `await node.getScrollOffset()`.
- [x] Add read-after-write tests such as style mutation followed immediately by `measure()`.

### Focus

- [x] Make Rust/GPUI authoritative for focus state.
- [x] Implement persistent `FocusHandle` ownership per focusable node.
- [x] Implement `node.focus()` as a synchronous submission command.
- [x] Implement `node.blur()` as a no-op unless that node is currently focused.
- [x] Allow focus requests for retained-but-detached nodes through the persistent handle.
- [x] Preserve the same focus handle across detach/reattach.
- [x] Forward actual GPUI focus-loss/focus-return events.
- [x] Do not synthesize detach blur or focus continuity.
- [x] Implement browser-style `tabIndex` mapping.
- [x] Make negative `tabIndex` programmatically focusable but skipped by sequential Tab navigation.
- [x] Give native text controls their expected default tab-stop behavior.

### Scrolling

- [x] Implement retained `ScrollHandle` ownership.
- [x] Implement `overflow: 'visible'` as non-clipped/non-scroll-container.
- [x] Implement `overflow: 'clip'` as clipped/non-scroll-container with programmatic scrolling disabled.
- [x] Implement `overflow: 'hidden'` as clipped scroll-container with programmatic scrolling but no wheel/trackpad or scrollbar UI.
- [x] Implement `overflow: 'auto'` with scrollability.
- [x] Implement `overflow: 'scroll'` with scrollability.
- [x] Reuse `gpui-base::Scrollbar` with the retained `ScrollHandle` for general scroll containers.
- [x] Use activity-driven scrollbar visibility for `auto` and always-visible-on-overflow scrollbar policy for `scroll`.
- [x] Preserve one handle/offset while switching among `hidden`, `auto`, and `scroll`.
- [x] Release scroll-container state when entering `visible` or `clip`.
- [x] Create fresh scroll state at initial offset when returning from `visible`/`clip`.
- [x] Implement `scrollTo()`.
- [x] Implement `scrollBy()`.
- [x] Implement `scrollIntoView()`.
- [x] Keep smooth/animated scrolling outside v1.
- [x] Coalesce `scroll` events per node per frame, latest-wins.

### Text input and textarea

- [x] Implement `input` using GPUI `EntityInputHandler`/`ElementInputHandler` patterns.
- [x] Implement single-line editing behavior.
- [x] Implement `textarea` multi-line editing and wrapping.
- [x] Implement `minRows`/`maxRows` auto-sizing.
- [x] Keep native value, caret, selection, undo/redo, and composition state authoritative in Rust.
- [x] Implement a bounded undo/redo history with character-run coalescing.
- [x] Apply platform edits natively before notifying JavaScript.
- [x] Treat an incoming controlled `value` identical to the current native value as a no-op.
- [x] Preserve caret, selection, undo, and active composition on identical controlled writes.
- [x] Replace native contents immediately on a different controlled value.
- [x] Clear the current marked/composition range when a different controlled value wins during composition.
- [x] Implement `setSelectionRange(start, end)`.
- [x] Implement `select()`.
- [x] Implement `await getSelection()`.
- [x] Implement `input` event on each user value edit.
- [x] Implement `change` on committed edits.
- [x] Commit `change` on blur after a value change.
- [x] Commit single-line `input` on Enter.

### Phase 3 tests

- [x] Add focus persistence tests across detach/reattach.
- [x] Add detached-focus command tests.
- [x] Add `tabIndex` navigation tests.
- [x] Add query ordering/read-barrier tests.
- [x] Add zeroed detached-measure tests.
- [x] Add pending-query rejection tests for close/poison.
- [x] Add all five overflow-mode behavior tests.
- [x] Add scroll-handle preservation/release tests.
- [x] Add programmatic-scroll tests for `hidden` and rejection/no-op semantics for `clip`.
- [x] Add input controlled-value no-op tests preserving caret/composition.
- [x] Add input overwrite-during-composition tests.
- [x] Add selection command/query ordering tests.
- [x] Add `input` and `change` native behavior tests.

### Phase 3 completion gate

- [x] Keyboard events reach the correct focused Retend targets and propagate with the documented semantics.
- [x] Native focus, scrolling, and text editing work without frame-by-frame or keystroke-by-keystroke JavaScript round trips.
- [x] Commands and queries satisfy read-after-write ordering guarantees.
- [x] `input` and `textarea` support native IME, selection, controlled values, and the documented v1 browser-like event semantics.
- [x] Detached/reattached nodes preserve the native state that `NATIVE.md` requires.

## Phase 4 — Motion, Legacy Cleanup, Packaging, and Production Hardening

Goal: complete the v1 feature surface, stabilize and harden the protocol after real renderer use in Phases 2 and 3, remove residual GPUiX artifacts, and make the bridge shippable and diagnosable across supported platforms.

### Protocol hardening

- [x] Add comprehensive fixed golden-byte vectors asserted independently by the TypeScript writer and Rust decoder for the current opcode/layout surface.
- [x] Keep schema/code generation limited to shared numeric protocol vocabulary while the current fixed command reader/writer surface remains smaller and more type-safe handwritten than equivalent generator machinery.
- [x] Keep semantic validation, direct command application, and retained-tree behavior handwritten.

### Native transitions

- [x] Use GPUI Base keyed per-node/per-property transition channels instead of a parallel Retend playback engine.
- [x] Delegate presentation values, timing state, interpolation, retargeting/reversal, frame scheduling, and reduced-motion handling to GPUI Base.
- [x] Keep Retend responsible for committed author-target resolution, lightweight previous-author-target/eligibility bookkeeping, CSS-style declaration parsing, unsupported-endpoint fallback, and pseudo-state precedence; static nodes do not keep GPUI transition channels alive.
- [x] Implement the v1 animatable set: `width`, `height`, `top`, `right`, `bottom`, `left`, `opacity`, and `borderRadius`.
- [x] Extend the animatable set with `backgroundColor` and `color`, which interpolate through GPUI's `Hsla` channels.
- [x] Implement initial-render behavior with no transition through GPUI's first-target adoption.
- [x] Implement transition eligibility from the after-change resolved style.
- [x] Retarget interrupted transitions through GPUI's sampled current presentation value rather than mirroring visible values in Retend state.
- [x] Implement cancellation and snap behavior when transition configuration/property eligibility changes.
- [x] Implement fail-soft invalid transition declarations.
- [x] Parse duration, delay, and timing-function strings in Rust and map them to GPUI transition policies.
- [x] Implement hover/active pseudo-state selection natively.
- [x] Apply pseudo-state precedence `active > hover > base`.
- [x] Route static pseudo-state changes and transitioned pseudo-state changes through the same GPUI transition channels.
- [x] Ensure reactive base/hover/active author snapshots can be updated from JavaScript without moving pointer-state ownership to JS.
- [x] Reconcile `MOTION.md` so its implementation description matches GPUI-owned playback.

### Native performance investigation

- [x] Add a CPU-side native benchmark for full static redraws, opacity transitions, and layout transitions at 100/1,000/5,000 nodes.
- [x] Profile Retend element construction separately from GPUI request/layout, Taffy solve, prepaint, and paint.
- [x] Keep cached-view replay experiments benchmark-only; do not add Retend-owned subtree selection, invalidation, retained geometry, or synchronization machinery to production rendering without real-application evidence.
- [x] Current debug profiling points to Retend element construction and GPUI paint/cache replay as the dominant CPU costs. The test harness does not measure native GPU presentation.
- [ ] Investigate GPUI's paint/`Scene::replay` path before adding any Retend-side caching or compositor architecture.
- [ ] Record release-mode and browser baselines for representative real application shapes.

### Full Vite/dev integration

- [x] Remove residual GPUiX-specific assumptions from `VITE.md` and the migrated development-runtime implementation path.
- [x] Preserve native windows across application full reload.
- [x] Run application cleanup before replacing the JavaScript application instance.
- [x] Remount existing window roots after full reload while preserving each live renderer/native-window binding as required by the lifecycle contract.
- [x] Ensure Vite/server restart still terminates the application process and recreates configured initial windows.
- [x] Ensure application crashes remain distinguishable from dev-server/config restarts.
- [x] Wire native fatal-screen manual reload into the development lifecycle.

### Legacy GPUiX cleanup

- [x] Remove direct `@gpuix/native` imports from source and JSX types.
- [x] Delete residual GPUiX-specific renderer/host code once the Phase 2/3 Retend-owned path has full v1 parity.
- [x] Port or remove the remaining legacy examples now that Phase 3 and motion functionality run on the Retend-owned path.
- [x] Port/finalize renderer tests across the focused TypeScript protocol tests and real Rust bridge tiers.
- [x] Finalize the main package exports and native loader/package paths used by production distribution; optional platform dependency publication remains in the packaging section below.
- [x] Update README/current architecture docs to describe the Retend-owned bridge rather than the removed GPUiX implementation.
- [x] Remove the `@gpuix/native` package dependency.

### Alpha application-surface polish

- [x] Add native `button` support with sensible default control styling.
- [x] Add default native styling for `input` and other built-in controls so basic forms are usable without recreating platform affordances manually.
- [x] Add logical spacing shorthands: `paddingInline`, `paddingBlock`, `marginInline`, and `marginBlock`.
- [x] Add supported CSS color keywords to the native color parser and TypeScript authoring surface.
- [x] Add configurable text-selection background styling for `input` and `textarea`.

### Image, asset, and accessibility polish

- [x] Add `img` load/error event delivery (`onLoad` / `onError`) from the native image pipeline.
- [ ] Add `alt` support for images and carry the semantic text into the native accessibility surface where supported.
- [x] Add SVG image/source support for normal application assets.
- [x] Reconcile relative/bundled asset handling with the production Vite asset pipeline so alpha applications are not limited to HTTP(S) image sources.

### Scaffolding and starter polish

- [ ] Implement the GPUI target in `retend-start` according to `SCAFFOLDING.md`.
- [ ] Add `retend-start` GPUI templates for `application.ts`, the root entry, Vite configuration, package metadata, and TypeScript/JSX configuration.
- [ ] Include a router-capable GPUI starter path so a newly scaffolded native project can exercise the supported Retend router without manual setup.

### Desktop integration polish

- [ ] Show the configured application/process name correctly in Activity Monitor and equivalent platform process surfaces where applicable.
- [ ] Add supported native window title-bar customization.
- [ ] Fix macOS fullscreen/title-bar behavior so the standard traffic-light controls reveal correctly when the pointer reaches the top of a fullscreen window.
- [ ] Manually verify the native fatal poisoning screen and reload interaction in a real development window.

### Maintenance and test-surface polish

- [x] Remove redundant, revision-driven, or implementation-only tests that no longer protect external behavior.

### Prebuilt binaries and packaging

- [ ] Produce prebuilt addon artifacts for supported OS/architecture combinations.
- [x] Package platform binaries as optional platform dependencies.
- [x] Validate useful failure messages for unsupported platforms/architectures or missing binary packages.
- [ ] Validate macOS application-bundle integration.
- [ ] Validate Windows/Linux runtime startup and shutdown behavior.
- [ ] Ensure native application identity/window metadata integrates with the production packaging path defined in `VITE.md`.

### Hardening and performance

- [x] Profile command-batch decode/application costs.
- [x] Profile retained-tree snapshot/locking strategy under frequent updates.
- [x] Replace coarse locking only if profiling shows it is required.
- [x] Profile native event delivery under heavy mousemove/scroll input.
- [x] Verify coalescing prevents JS backlog growth.
- [x] Profile large Retend trees and repeated style snapshot updates.
- [ ] Verify semantic strings are parsed once per committed property value rather than every GPUI render.
- [x] Stress-test detach/reattach/settle cycles for leaks.
- [x] Stress-test image source replacement and destruction.
- [x] Stress-test multi-window creation/close/reload cycles.
- [x] Stress-test focus, scroll, input, and transition runtime-state cleanup.

### Final conformance suite

- [x] Run protocol golden-vector tests in TypeScript and Rust.
- [x] Run Rust decoder fuzz/property tests.
- [x] Run native integration tests on macOS.
- [ ] Run native integration tests on Windows.
- [ ] Run native integration tests on Linux.
- [x] Run multi-window tests.
- [x] Run Vite HMR/full-reload/dev-fatal tests.
- [x] Run motion retargeting/cancellation/pseudo-state tests.
- [x] Run input/IME/focus/scroll integration tests.
- [ ] Build all examples against the new bridge.
- [x] Confirm no source/runtime dependency on `@gpuix/native` remains.

### Phase 4 completion gate

- [x] The Retend-owned native bridge is the only native rendering path in `retend-gpui`.
- [ ] The v1 contract in `NATIVE.md`, `MOTION.md`, and `VITE.md` is implemented and covered by tests.
- [ ] Prebuilt binaries load on supported platforms without requiring a user Rust toolchain.
- [ ] Development reload/error behavior and production process/window lifetimes match the documented contracts.
- [x] The package builds, tests, examples, and native integration suite are green with `@gpuix/native` removed.

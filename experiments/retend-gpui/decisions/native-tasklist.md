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
- [x] Implement native node kinds for container, text, span/text-run identity, image, input, textarea, and structural anchors as required by the protocol.
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
- [x] Represent anchors with stable retained identity while omitting them from GPUI layout.

### Fatal bridge path

- [x] Define structured native bridge-failure payloads.
- [x] On command/invariant failure, preserve the valid prefix, leave the failing command unapplied, and poison the affected native window before releasing the retained-tree lock.
- [x] On wire-format failure, poison the affected native window without mutating retained state.
- [x] Catch native bridge failures at the JS renderer/host boundary.
- [x] Capture the JavaScript stack for fatal renderer bugs.
- [x] Permanently poison the affected renderer.
- [x] Implement the dedicated out-of-band fatal diagnostic command.
- [x] Implement a native fatal diagnostic surface for a poisoned renderer/window.
- [x] Reject all later normal renderer mutations after poisoning.
- [x] Keep semantic style-value parse failures out of the fatal bridge path.

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

Goal: make the Retend-owned bridge the normal renderer path for Retend GPUI, with `div`, text, spans, images, styles, pointer/keyboard events, and independent native windows. Phase 3 must build on this renderer rather than on a parallel native test harness or the previous GPUiX path.

### GPUI render pipeline

- [x] Implement retained-tree-to-GPUI render traversal per window.
- [x] Construct a fresh GPUI element tree for each render.
- [ ] Map stable Retend IDs to GPUI `ElementId`s where persistent GPUI state requires them.
- [x] Keep GPUI-bound objects in the native execution context rather than in retained-tree data.
- [ ] Collect GPUI/runtime-effect intents during command application and execute them only after the complete batch succeeds.
- [ ] Discard runtime-effect intents and skip normal rendering when a batch poisons its window.
- [x] Add dirty-window scheduling after successful command batches.
- [ ] Ensure one successful command batch advances one committed generation and schedules one coherent render update.

### Style schema and native parsing

- [x] Define the v1 property schema and numeric property IDs.
- [ ] Define TypeScript authoring types for supported properties.
- [x] Implement the generic tagged property-value wire shape for numbers, booleans, string-table references, and removal/null.
- [x] Keep property-specific semantics in Rust rather than creating property-specific binary layouts.
- [ ] Implement Rust semantic parsers for keyword values.
- [x] Implement Rust percentage/length parsing.
- [x] Implement Rust color parsing.
- [ ] Implement Rust transition-duration/delay/timing parsing needed by later motion support.
- [ ] Store parsed Retend-native values during command application.
- [ ] Implement fail-soft behavior for invalid semantic style values.
- [ ] Send complete resolved author-style snapshots from JavaScript.
- [ ] Keep GPUI defaults, Retend intrinsic defaults, and inherited/computed style out of JavaScript snapshots.
- [x] Implement block as the default `div` display behavior.
- [x] Make flex opt-in with `display: 'flex'`.
- [x] Preserve explicit Retend root background/text-color defaults.

### Basic intrinsic rendering

- [x] Implement `div` rendering.
- [x] Implement dedicated native text nodes.
- [ ] Implement shaped text leaves for contiguous text runs.
- [ ] Implement `span` as a styled text run rather than a GPUI box.
- [ ] Flatten nested spans into nested styled ranges.
- [ ] Apply outer span text styles as inherited run styles and inner span overrides on top.
- [ ] Preserve a distinct node ID for every span for refs and event targeting.
- [ ] Reject box-layout styles on spans with a descriptive development error.
- [ ] Reject layout-bearing element children inside spans.
- [ ] Implement mixed text/element lowering as separate text leaves and element boxes.
- [ ] Implement `img` by mapping Retend `src` to GPUI image sources.
- [ ] Delegate loading, decoding, caching, intrinsic metadata, and rendering to GPUI's image/asset system.
- [ ] Replace the GPUI image source reactively when `src` changes.
- [ ] Release node-owned image state when the Retend image node is destroyed.
- [ ] Reject unsupported intrinsic tags with a descriptive render-time error.

### Native event transport

- [ ] Define the static native event metadata table.
- [ ] Implement structured Rust→JS N-API event delivery.
- [ ] Include `targetId` derived from native hit testing.
- [ ] Implement pointer payload fields: `clientX`, `clientY`, `button`, `buttons`, `detail`, modifiers, and `timeStamp`.
- [ ] Implement text-range hit targeting for spans.
- [ ] Implement native event subscription bookkeeping keyed by node ID/event type.
- [ ] Make listener registration/removal effective synchronously for active nodes.
- [ ] Flush pending insertion before synchronizing a listener on a logically active but not-yet-submitted node.
- [ ] Coalesce `mousemove` latest-wins while delivery is pending.
- [ ] Keep discrete native events ordered and uncoalesced.
- [ ] Drop stale events whose target ID is destroyed or detached when JS dispatch begins.

### Retend event dispatch

- [ ] Implement Retend-owned `addEventListener`, `removeEventListener`, and `dispatchEvent` registry behavior.
- [ ] Keep Retend nodes EventTarget-compatible without relying on built-in `EventTarget` inheritance.
- [ ] Snapshot the complete propagation path before dispatch.
- [ ] Snapshot each node's listener list before invoking that node.
- [ ] Suppress listeners removed before their turn.
- [ ] Exclude listeners added during the current node dispatch.
- [ ] Implement capture, target, and bubble phases according to event metadata.
- [ ] Implement non-bubbling `mouseenter`, `mouseleave`, `focus`, `blur`, and element `scroll` semantics.
- [ ] Implement `stopPropagation()` and `stopImmediatePropagation()`.
- [ ] Route listener exceptions through the normal Retend application/dev error path without poisoning the renderer.
- [ ] Limit `preventDefault()` to Retend-side default actions; do not imply cancellation of already-completed native behavior.
- [ ] Implement the `mousedownoutside` native extension.

### Window surface

- [ ] Implement JavaScript window wrappers over Rust window IDs.
- [ ] Implement title updates.
- [ ] Push native resize events to JavaScript; remove size polling.
- [ ] Implement per-window focus/blur lifecycle events.
- [ ] Implement `closeWithOpener` lifetime behavior.
- [ ] Implement resizable state.
- [ ] Implement fullscreen/maximized state.
- [ ] Implement minimum-size constraints.
- [ ] Implement maximum-size constraints using platform support where required.
- [ ] Support multiple independent Retend roots/windows in one process.
- [ ] Preserve native windows across Vite full reload according to `VITE.md`.

### Development root/error integration

- [ ] Keep one immutable native root per window.
- [ ] Mount a stable Retend development wrapper beneath the root.
- [ ] Render the application subtree and recoverable dev overlay inside that same Retend tree.
- [ ] Preserve the existing application subtree during recoverable compile/HMR errors.
- [ ] Remove the overlay after a successful update.
- [ ] Allow the wrapper to show errors before the application entry has successfully mounted.

### Renderer migration

- [ ] Port `gpui-renderer.ts` and its host mutation path onto `NativeCommandHost` and the Retend-owned command protocol.
- [ ] Make normal Retend GPUI renderer/window creation use the Retend-owned native binding rather than the GPUiX native renderer.
- [ ] Preserve the JavaScript node lifecycle contract on the migrated renderer, including permanent destroyed-node state, reactive cleanup, ref cleanup, and stale-event rejection.
- [ ] Route the Phase 2 style, event, window, and development-overlay behavior through the migrated renderer rather than maintaining a second native-only implementation path.
- [ ] Port Phase 2-capable examples to the v1 intrinsic/style/event surface and run them through the migrated renderer.
- [ ] Ensure the renderer surface needed by Phase 3 extends this migrated path directly; do not keep a separate GPUiX renderer as the implementation target for focus, queries, scrolling, or text controls.
- [ ] Leave only genuinely residual GPUiX compatibility/dead-code cleanup for Phase 4; no active normal renderer path may depend on GPUiX after this phase.

### Phase 2 tests

- [ ] Add renderer conformance tests for `div`, text nodes, mixed content, and spans through the migrated Retend-owned renderer path.
- [ ] Add nested-span inheritance/override tests.
- [ ] Add unsupported-span-style and invalid-child tests.
- [x] Add native style parser tests, including fail-soft invalid values.
- [ ] Add image source replacement tests.
- [ ] Add event bubbling/non-bubbling tests.
- [ ] Add listener snapshot/mutation-during-dispatch tests.
- [ ] Add stale-event and mousemove-coalescing tests.
- [ ] Add span text-range targeting tests.
- [ ] Add multi-window isolation tests.
- [ ] Add native resize-event tests.

### Phase 2 completion gate

- [ ] A normal Retend application renders styled `div`, text, nested spans, and images in one or more native windows through the Retend-owned bridge.
- [ ] `gpui-renderer.ts` and the normal development/runtime renderer path use the Retend-owned command host and native binding for the Phase 2 feature surface.
- [ ] No active normal renderer path depends on GPUiX; Phase 3 can add stateful native capabilities directly to the migrated renderer.
- [ ] Pointer and keyboard events reach the correct Retend targets and propagate with the documented semantics.
- [ ] Resizing and window lifecycle changes arrive through native events rather than polling.
- [ ] Recoverable development errors render without replacing the native root/window.

## Phase 3 — Focus, Queries, Scrolling, and Native Text Controls

Goal: add the stateful native capabilities that require persistent GPUI runtime objects and strict ordering between JavaScript commands and authoritative native state.

### Native runtime-state registry

- [ ] Add per-node native runtime state keyed by stable node ID.
- [ ] Persist GPUI `FocusHandle`s independently of ephemeral GPUI element instances.
- [ ] Persist GPUI `ScrollHandle`s for scroll-container states.
- [ ] Persist text-input editor state for `input` and `textarea`.
- [ ] Destroy associated runtime state during native settlement and window destruction.

### Imperative command/query framework

- [ ] Implement node-bound native command methods.
- [ ] Keep native-backed property getters out of the public API.
- [ ] Implement synchronous submission ordering for native commands.
- [ ] Reject commands immediately on permanently destroyed nodes.
- [ ] Implement async native query transport.
- [ ] Flush pending renderer mutations before every native query.
- [ ] Order queries after all earlier native commands.
- [ ] Add an internal per-window render/layout generation or fence.
- [ ] Resolve layout queries only from a generation that includes all preceding submitted work.
- [ ] Reject pending queries when the renderer/window closes or becomes poisoned.
- [ ] Return neutral zeroed layout data for retained-but-detached nodes.

### Layout/query surface

- [ ] Implement `await node.measure()`.
- [ ] Return border-box `x`, `y`, `width`, and `height` in window coordinates.
- [ ] Include `scrollWidth` and `scrollHeight`.
- [ ] Implement `await node.getScrollOffset()`.
- [ ] Add read-after-write tests such as style mutation followed immediately by `measure()`.

### Focus

- [ ] Make Rust/GPUI authoritative for focus state.
- [ ] Implement persistent `FocusHandle` ownership per focusable node.
- [ ] Implement `node.focus()` as a synchronous submission command.
- [ ] Implement `node.blur()` as a no-op unless that node is currently focused.
- [ ] Allow focus requests for retained-but-detached nodes through the persistent handle.
- [ ] Preserve the same focus handle across detach/reattach.
- [ ] Forward actual GPUI focus-loss/focus-return events.
- [ ] Do not synthesize detach blur or focus continuity.
- [ ] Implement browser-style `tabIndex` mapping.
- [ ] Make negative `tabIndex` programmatically focusable but skipped by sequential Tab navigation.
- [ ] Give native text controls their expected default tab-stop behavior.

### Scrolling

- [ ] Implement retained `ScrollHandle` ownership.
- [ ] Implement `overflow: 'visible'` as non-clipped/non-scroll-container.
- [ ] Implement `overflow: 'clip'` as clipped/non-scroll-container with programmatic scrolling disabled.
- [ ] Implement `overflow: 'hidden'` as clipped scroll-container with programmatic scrolling but no wheel/trackpad or scrollbar UI.
- [ ] Implement `overflow: 'auto'` with scrollability and conditional scrollbar presentation.
- [ ] Implement `overflow: 'scroll'` with scrollability and always-visible scrollbar presentation.
- [ ] Preserve one handle/offset while switching among `hidden`, `auto`, and `scroll`.
- [ ] Release scroll-container state when entering `visible` or `clip`.
- [ ] Create fresh scroll state at initial offset when returning from `visible`/`clip`.
- [ ] Implement `scrollTo()`.
- [ ] Implement `scrollBy()`.
- [ ] Implement `scrollIntoView()`.
- [ ] Keep smooth/animated scrolling outside v1.
- [ ] Coalesce `scroll` events per node per frame, latest-wins.

### Text input and textarea

- [ ] Implement `input` using GPUI `EntityInputHandler`/`ElementInputHandler` patterns.
- [ ] Implement single-line editing behavior.
- [ ] Implement `textarea` multi-line editing and wrapping.
- [ ] Implement `minRows`/`maxRows` auto-sizing.
- [ ] Keep native value, caret, selection, undo/redo, and composition state authoritative in Rust.
- [ ] Implement a bounded undo/redo history with character-run coalescing.
- [ ] Apply platform edits natively before notifying JavaScript.
- [ ] Treat an incoming controlled `value` identical to the current native value as a no-op.
- [ ] Preserve caret, selection, undo, and active composition on identical controlled writes.
- [ ] Replace native contents immediately on a different controlled value.
- [ ] Clear the current marked/composition range when a different controlled value wins during composition.
- [ ] Implement `setSelectionRange(start, end, direction?)`.
- [ ] Implement `select()`.
- [ ] Implement `await getSelection()`.
- [ ] Implement `input` event on each user value edit.
- [ ] Implement `change` on committed edits.
- [ ] Commit `change` on blur after a value change.
- [ ] Commit single-line `input` on Enter.
- [ ] Expose `compositionstart`, `compositionupdate`, and `compositionend`.

### Phase 3 tests

- [ ] Add focus persistence tests across detach/reattach.
- [ ] Add detached-focus command tests.
- [ ] Add `tabIndex` navigation tests.
- [ ] Add query ordering/read-barrier tests.
- [ ] Add zeroed detached-measure tests.
- [ ] Add pending-query rejection tests for close/poison.
- [ ] Add all five overflow-mode behavior tests.
- [ ] Add scroll-handle preservation/release tests.
- [ ] Add programmatic-scroll tests for `hidden` and rejection/no-op semantics for `clip`.
- [ ] Add input controlled-value no-op tests preserving caret/composition.
- [ ] Add input overwrite-during-composition tests.
- [ ] Add selection command/query ordering tests.
- [ ] Add `input`, `change`, and composition-event tests.

### Phase 3 completion gate

- [ ] Native focus, scrolling, and text editing work without frame-by-frame or keystroke-by-keystroke JavaScript round trips.
- [ ] Commands and queries satisfy read-after-write ordering guarantees.
- [ ] `input` and `textarea` support native IME, selection, controlled values, and documented browser-like event semantics.
- [ ] Detached/reattached nodes preserve the native state that `NATIVE.md` requires.

## Phase 4 — Motion, Legacy Cleanup, Packaging, and Production Hardening

Goal: complete the v1 feature surface, stabilize and harden the protocol after real renderer use in Phases 2 and 3, remove residual GPUiX artifacts, and make the bridge shippable and diagnosable across supported platforms.

### Protocol hardening

- [ ] Build the TypeScript reference protocol interpreter with a mirror retained tree.
- [ ] Add differential tests that run structural command batches through both the TypeScript reference interpreter and the Rust implementation.
- [ ] Add comprehensive fixed golden-byte vectors asserted independently by TypeScript and Rust after the core opcode/layout surface is stable.
- [ ] Extend the authoritative protocol schema/code generator beyond shared numeric IDs to repetitive command reader/writer scaffolding where doing so reduces boilerplate without moving semantic validation into generated code.
- [ ] Keep semantic validation, direct command application, and retained-tree behavior handwritten.

### Native transition engine

- [ ] Implement per-node/per-property transition state in Rust.
- [ ] Store current visible value, target value, start time, duration, delay, and easing.
- [ ] Advance transitions from GPUI's frame/render cycle with no animation-frame traffic to JavaScript.
- [ ] Implement the v1 animatable set: `width`, `height`, `top`, `right`, `bottom`, `left`, `opacity`, and `borderRadius`.
- [ ] Implement initial-render behavior with no transition.
- [ ] Implement transition eligibility from the after-change resolved style.
- [ ] Implement retargeting from the current visible interpolated value.
- [ ] Implement cancellation and snap behavior when transition configuration/property eligibility changes.
- [ ] Implement fail-soft invalid transition declarations.
- [ ] Parse duration, delay, and timing-function strings in Rust.
- [ ] Implement hover/active pseudo-state selection natively.
- [ ] Apply pseudo-state precedence `active > hover > base`.
- [ ] Route static pseudo-state changes and transitioned pseudo-state changes through the same native state machine.
- [ ] Ensure reactive base/hover/active author snapshots can be updated from JavaScript without moving pointer-state ownership to JS.
- [ ] Reconcile `MOTION.md` so its implementation description matches the Rust-owned engine.

### Full Vite/dev integration

- [ ] Remove any residual GPUiX-specific assumptions from `VITE.md` and development-runtime implementation paths after the Phase 2 renderer migration.
- [ ] Preserve native windows across application full reload.
- [ ] Run application cleanup before replacing the JavaScript application instance.
- [ ] Remount existing window roots after full reload using fresh renderers/bindings as required by the lifecycle contract.
- [ ] Ensure Vite/server restart still terminates the application process and recreates configured initial windows.
- [ ] Ensure application crashes remain distinguishable from dev-server/config restarts.
- [ ] Wire native fatal-screen manual reload into the development lifecycle.

### Legacy GPUiX cleanup

- [ ] Remove any remaining direct `@gpuix/native` imports from source and JSX types that were not eliminated by the Phase 2 renderer migration.
- [ ] Delete residual GPUiX-specific renderer/host code once the Phase 2/3 Retend-owned path has full v1 parity.
- [ ] Port any remaining examples that could not move during Phase 2 because they depend on Phase 3 or motion functionality.
- [ ] Port/finalize renderer tests across the TypeScript reference interpreter and real Rust bridge tiers.
- [ ] Finalize package exports and native loader paths for production distribution.
- [ ] Update README/docs to describe only the Retend-owned bridge.
- [ ] Remove the `@gpuix/native` dependency after all remaining legacy references are gone.

### Prebuilt binaries and packaging

- [ ] Produce prebuilt addon artifacts for supported OS/architecture combinations.
- [ ] Package platform binaries as optional platform dependencies.
- [ ] Implement runtime selection/loading of the correct binary package.
- [ ] Validate useful failure messages for unsupported platforms/architectures or missing binary packages.
- [ ] Validate macOS application-bundle integration.
- [ ] Validate Windows/Linux runtime startup and shutdown behavior.
- [ ] Ensure native application identity/window metadata integrates with the production packaging path defined in `VITE.md`.

### Hardening and performance

- [ ] Profile command-batch decode/application costs.
- [ ] Profile retained-tree snapshot/locking strategy under frequent updates.
- [ ] Replace coarse locking only if profiling shows it is required.
- [ ] Profile native event delivery under heavy mousemove/scroll input.
- [ ] Verify coalescing prevents JS backlog growth.
- [ ] Profile large Retend trees and repeated style snapshot updates.
- [ ] Verify semantic strings are parsed once per committed property value rather than every GPUI render.
- [ ] Stress-test detach/reattach/settle cycles for leaks.
- [ ] Stress-test image source replacement and destruction.
- [ ] Stress-test multi-window creation/close/reload cycles.
- [ ] Stress-test focus, scroll, input, and transition runtime-state cleanup.

### Final conformance suite

- [ ] Run TypeScript reference-interpreter tests.
- [ ] Run protocol golden-vector tests in TypeScript and Rust.
- [ ] Run Rust decoder fuzz/property tests.
- [ ] Run native integration tests on macOS.
- [ ] Run native integration tests on Windows.
- [ ] Run native integration tests on Linux.
- [ ] Run multi-window tests.
- [ ] Run Vite HMR/full-reload/dev-fatal tests.
- [ ] Run motion retargeting/cancellation/pseudo-state tests.
- [ ] Run input/IME/focus/scroll integration tests.
- [ ] Build all examples against the new bridge.
- [ ] Confirm no source/runtime dependency on `@gpuix/native` remains.

### Phase 4 completion gate

- [ ] The Retend-owned native bridge is the only native rendering path in `retend-gpui`.
- [ ] The v1 contract in `NATIVE.md`, `MOTION.md`, and `VITE.md` is implemented and covered by tests.
- [ ] Prebuilt binaries load on supported platforms without requiring a user Rust toolchain.
- [ ] Development reload/error behavior and production process/window lifetimes match the documented contracts.
- [ ] The package builds, tests, examples, and native integration suite are green with `@gpuix/native` removed.

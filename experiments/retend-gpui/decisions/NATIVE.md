# Native Bridge Architecture

This document defines the architecture, implementation model, and v1 scope for the Retend-owned GPUI native bridge. `MOTION.md` and `VITE.md` define detailed motion and development/runtime semantics where referenced.

## Distribution model

The Rust native bridge ships as an N-API addon with prebuilt per-platform binaries. Node remains the main process and GPUI is embedded through the addon. Packaging uses a main JavaScript package plus per-platform binary packages such as `darwin-arm64` and `linux-x64`.

Shipping applications use the appropriate platform application bundle around the runtime. The binary transaction protocol is independent of the embedding topology; the N-API bridge implementation itself is runtime-specific.

## Transaction boundary

Synchronous native mutations accumulate in the JavaScript host queue and one queued microtask flushes them as a single native transaction. Explicit renderer/host `flush()` calls synchronously drain the current queue.

JavaScript batches all Retend-driven native mutations for one update into an ordered transaction. Rust validates the complete transaction before mutating its authoritative native tree. If any operation is invalid, the entire transaction fails and the native tree remains unchanged. Once validated, Rust applies the transaction atomically and performs the corresponding GPUI reconciliation/render work once. Retend reconciliation remains in JavaScript; Rust does not implement framework-level keyed or component reconciliation semantics.

## Boundary ownership

Retend GPUI uses a Retend-specific native bridge with a contract designed around Retend's renderer model. The bridge owns the JS/Rust boundary for mutation batching, events, windows, styles, motion, testing, and multi-window behavior.

## Platform threading and event loop

On macOS, AppKit/GPUI runs on the process main thread and the embedded bridge pumps the GPUI/AppKit event loop through the main-thread integration/tick model. On Windows and Linux, GPUI may run its blocking event loop on a dedicated native UI thread, with JavaScript communicating through the in-process bridge.

The public JS/native protocol is topology-independent. Command ordering, transaction semantics, event delivery, renderer behavior, and multi-window behavior have the same contract whether GPUI work executes on the process main thread or a dedicated native UI thread.

## Transaction validation threading

The N-API `applyTransaction(buffer)` call decodes, validates, and atomically updates the retained native tree before returning to JavaScript. Rust decodes the command stream into a transaction-local ordered operation list and validates that sequence against the current `NativeTree` plus a transaction-local structural overlay containing only staged facts such as newly created node IDs, parent overrides, removals, and other structural state needed to validate later operations in the same transaction. The authoritative tree is not cloned and is not mutated during validation. Once the complete operation sequence is valid, Rust replays the already-validated operations into `NativeTree`; a failure during that replay is an internal bridge bug rather than an application/protocol validation outcome. The retained tree stores parsed Retend-native plain Rust data rather than GPUI-bound objects. Author-facing semantic strings are carried through the transaction string table and parsed by Rust during transaction application; parsed values are stored so rendering does not repeatedly parse them.

The native GPUI execution context reads retained data and owns GPUI-bound runtime objects such as `FocusHandle`s, `ScrollHandle`s, text-input state, and animation state keyed by stable node IDs. Successful transactions schedule dirty/render work for that execution context. On macOS this is the process-main-thread GPUI/AppKit integration; on Windows and Linux it may be a dedicated native UI thread.

The retained tree and GPUI-bound runtime state have separate ownership. The transaction path mutates retained plain data; the GPUI execution context owns live GPUI objects. Snapshot/locking strategy is an implementation detail that should be chosen from profiling rather than assumed up front.

Synchronous validation and submission do not imply synchronous visual completion. Native commands return after ordered submission; native queries wait for the native work needed to produce their result.

## Transaction scope

Each native transaction targets exactly one native window. An application update that affects multiple windows is split into separate per-window transactions, each validated and committed independently; there is no process-wide atomic transaction spanning multiple windows.

## Transaction validation errors

A native transaction validation failure is a fatal Retend GPUI renderer bug, not a recoverable application error. Rust rejects the transaction atomically and synchronously returns structured failure details to JavaScript. JavaScript catches that failure at the renderer/host boundary, captures a JavaScript stack trace, permanently poisons the current renderer, and sends one dedicated out-of-band fatal diagnostic command back to Rust carrying the native failure details and JavaScript stack. That fatal-reporting command is outside the normal transaction protocol and remains available specifically for this poisoned-renderer path.

Once poisoned, the renderer accepts no further normal mutations or transactions. Rust stops normal Retend rendering for that binding and presents a native fatal diagnostic surface containing both the native transaction failure and the JavaScript stack. No automatic rollback, retry, tree reconstruction, or best-effort continuation is attempted.

In development, the native fatal screen may expose a manual Reload action. Reload tears down the poisoned JavaScript renderer/application instance and creates a fresh renderer/application binding for the same existing native window; it does not recreate the OS window. A native window that has actually closed remains permanently invalid and cannot be rebound.

## Semantic application-value errors

Structurally valid transactions are not rejected merely because an application supplied a semantically invalid style value. Malformed protocol data, invalid node references, unsupported opcodes, corrupt indexes, and other JS/Rust contract violations remain fatal renderer bugs. By contrast, property-level parse failures such as an invalid color, length, or transition declaration fail soft according to that property's semantics and do not poison the renderer. Fatal transaction validation is reserved for protocol/invariant violations rather than ordinary bad application input.

## Transaction ordering

Transactions do not carry explicit revision or sequence numbers. The native bridge is synchronous, and transaction ordering is guaranteed by the transport and single in-flight application model rather than by an additional protocol-level revision state machine.

## Binary protocol

Transactions cross the JavaScript/Rust boundary as one custom compact binary command buffer rather than structured N-API values or JSON. The protocol uses fixed opcodes and primitive encodings tailored to Retend GPUI instead of a generic serialization library.

The buffer header contains a small protocol version. Rust rejects unsupported versions so JavaScript/native mismatches fail explicitly rather than being decoded as malformed commands.

Known protocol vocabulary such as opcodes, element kinds, property names, event types, and other fixed symbols use static numeric IDs rather than strings. Those numeric assignments and fixed command field schemas have one authoritative machine-readable protocol schema. TypeScript and Rust protocol constants are generated from that schema rather than maintained independently. Repetitive fixed-schema writer/reader scaffolding should also be generated where practical, while semantic validation and retained-tree behavior remain handwritten. The custom Retend binary protocol remains the wire format; code generation exists to eliminate cross-language drift and boilerplate rather than to replace it with a general-purpose serialization format.

Structural insertion uses one fixed-schema `INSERT_CHILD(parentId, childId, beforeId)` opcode rather than separate append, insert-before, and move opcodes. A nonzero `beforeId` inserts or moves `childId` immediately before that existing child of `parentId`; `beforeId = 0` means append at the end. Node ID `0` is reserved by the protocol and is never a valid real node ID. Removal uses `REMOVE_CHILD(parentId, childId)`. The same insertion operation therefore covers first attachment, reattachment, same-parent reordering, and ordinary moves without introducing separate structural wire concepts.

Each transaction contains its own string table. Dynamic strings are encoded once per transaction and operations reference compact string-table indexes. The table is transaction-local; there is no persistent cross-transaction string interning state.

On the JavaScript side, command bytes and string-table bytes are built in separate growable regions. At flush time, the host allocates one final contiguous transaction buffer sized for the header, command stream, and string table, then copies the two regions into `HEADER → COMMANDS → STRING TABLE` order and fills the header offsets/counts. This keeps encoding simple and makes the final native payload contiguous without relying on repeated relocation or backpatching of a single growing buffer.

The transaction layout is `HEADER → COMMAND STREAM → STRING TABLE`. The header records the command-stream extent plus the string-table offset and count, allowing Rust to validate table bounds once and resolve string indexes directly while decoding commands.

Commands use fixed opcode-specific schemas with no per-command byte length. The decoder determines each payload shape from its opcode. Unknown opcodes, truncated payloads, and malformed fixed-schema payloads are fatal protocol errors.

## Property value encoding

Known properties use property-specific binary schemas rather than a generic tagged JavaScript-value format. A property ID determines how its value is decoded.

The public Retend GPUI style API uses a React-Native-like hybrid authoring model optimized for concise JavaScript/TypeScript. Bare numbers represent pixel-like numeric values where appropriate; simple closed vocabularies use constrained string literals such as `display: 'flex'`, `flexDirection: 'column'`, and `overflow: 'hidden'`; familiar textual forms such as percentage lengths and colors may remain concise author-facing values where appropriate. TypeScript types constrain these values so ordinary invalid keywords are rejected statically. Helpers/typed constructors are reserved for values that genuinely benefit from structure rather than being required for every keyword.

The JavaScript encoder stays intentionally lightweight. It serializes values according to their ordinary runtime shape rather than implementing a CSS-like semantic parser or normalizer. Numbers and booleans cross as native numeric/boolean fields; author-facing strings such as `'flex'`, `'50%'`, `'#fff'`, `'200ms'`, or `'ease-out'` cross through the transaction-local string table. Fixed protocol vocabulary such as property IDs, element kinds, event types, and opcodes still uses static numeric IDs.

Rust owns semantic style decoding. During transaction validation/application it interprets each property's incoming value according to that property's schema, parses textual semantic values where needed, converts them into parsed Retend-native representations, and stores those parsed values so GPUI rendering does not repeatedly reparse them. Property-level parse failures remain fail-soft application-value errors rather than protocol failures.

`MOTION.md` values such as CSS-style durations and timing functions remain concise author-facing strings and are parsed natively. The style API is specific to `retend-gpui`; other Retend renderers define their style surfaces independently.

## Node identity

JavaScript allocates stable node IDs before sending transactions. Rust treats those IDs as cross-boundary handles, validates uniqueness and lifetime, and remains the owner of the actual native nodes.

Node IDs are globally unique across the process and are never reused after deletion. Node ID `0` is permanently reserved as the null/sentinel ID and is never allocated to a real node. JavaScript allocates real node IDs monotonically from the remaining `u32` space starting at `1`; stale references therefore cannot accidentally resolve to a later node that reused the same ID. Allocation is owned by one process-scoped JavaScript runtime singleton shared by every renderer/window. Renderer replacement, application remounts, and development full reloads continue using the same allocator; it resets only when the Node process exits.

## Detached node lifetime

`retend:activate` is the formal structural-update-settled boundary. Native nodes may be temporarily detached while Retend restructures the tree, including moves performed by `Unique`. Rust tracks this directly from its authoritative parent/child tree: whenever an existing node is removed from its parent and left parentless, that node becomes a pending-detached root, even if its former parent was already pending-detached; reinsertion removes that node from the set. Pending-detached nodes remain fully mutable before settlement: text, style, listener, custom-property, and subtree mutations are valid and are preserved if the node is reattached. Settlement is not encoded as an opcode in the UI transaction protocol. The JavaScript host exposes a renderer-scoped `settle()` lifecycle operation that synchronously flushes all pending UI mutations for that renderer/window and then invokes the separate native `settle()` call, so callers cannot observe or invoke the boundary in the wrong order. `retend:activate` uses this operation. Rust recursively destroys every root still in the pending-detached set. Newly created nodes that have not yet been attached are not considered pending-detached merely because their parent is null. This prevents nested detached subtrees from being orphaned or leaked and keeps lifecycle control separate from ordinary UI mutation encoding.

## Integer widths

Node IDs and transaction string-table indexes are encoded as fixed unsigned 32-bit integers. The protocol does not use varints or narrower index widths; predictable decoding and one integer convention are preferred over marginal buffer-size savings.

## Stale native events

Native events cross from the GPUI/native event loop to Node's JavaScript thread asynchronously. If an event arrives in JavaScript for a node ID that has already been destroyed, JavaScript silently discards the event. If the target node still exists but is no longer attached under the active renderer root when JavaScript begins dispatch, the event is also discarded; retained identity alone does not make a detached node interactive. Because node IDs are never reused within the process, a stale event cannot target a later node with the same ID.

## Intrinsic element set

The v1 intrinsic set is `div`, `span`, `img`, `input`, and `textarea`.

Text is content rather than a JSX intrinsic. String children become dedicated native text nodes in the protocol. Scrolling is expressed through `overflow` on container elements rather than a dedicated scroll intrinsic. Unsupported intrinsic tags produce a descriptive render-time error. Additional element kinds can be added through the versioned numeric protocol vocabulary.

### Image handling

`img` delegates loading, decoding, caching, intrinsic image metadata, and rendering to GPUI's image/asset system. Retend maps its public `src` value into the appropriate GPUI image source, replaces that source reactively when `src` changes, and releases node-owned image state when the Retend node is destroyed.

### Text runs and mixed content

Contiguous bare text and spans are lowered into one shaped text leaf. Rust concatenates their text, builds the corresponding styled ranges, and uses GPUI text shaping/wrapping for the result. Mixed content such as `<div>text <img/> more</div>` lowers into separate children: a text leaf, the image box, then another text leaf. The parent lays those children out according to its configured GPUI display/layout style.

A span may contain only content representable by the text-run model. Element children requiring independent layout are invalid. Nested spans are supported and flattened into nested styled ranges. Inner spans inherit the enclosing span's text-run styles and override only the properties they explicitly define. Every nested span keeps its own stable Retend/bridge node ID for refs, parentage, and text-range event targeting.

## Span identity model

`span` is an inline interactive text-run node, not a general box element. It keeps stable Retend/bridge identity and parent linkage so refs and event targeting work, but it does not lower to an independent GPUI box or focusable element. Rust maps pointer interaction through GPUI text-range hit testing back to the span's stable node ID and sends normal Retend events with that span as the target.

Spans support text-run styling and text-range pointer events such as click, mouseenter, and mouseleave. They do not support box-layout properties such as width, height, padding, border, background, or positioning; applying box-only styles to a span is a clear development error. Spans are not focusable, do not support `tabIndex`, and have no box-oriented imperative commands. Span measurement may be added later through text-range bounds but is out of v1 scope.

A span may contain only text or other text content supported by the text-run model; element children that require independent layout are invalid. The contract is: spans participate in text styling, identity, refs, and events, but they are not boxes.

## Event vocabulary and payloads

The native protocol event vocabulary contains `click`, `dblclick`, `mousedown`, `mouseup`, `mouseenter`, `mouseleave`, `mousemove`, `keydown`, `keyup`, `input`, `change`, `focus`, `blur`, `scroll`, and the non-DOM extension `mousedownoutside`. JSX props keep React-style casing such as `onMouseDown`; protocol event names use their explicitly defined lowercase forms.

Application-defined custom events remain entirely in JavaScript and do not enter the native protocol vocabulary. Native event types carry propagation metadata. `mouseenter`, `mouseleave`, `focus`, `blur`, and element `scroll` are non-bubbling; ordinary pointer/button/key events such as `click`, `mousedown`, `mouseup`, `mousemove`, `keydown`, and `keyup` bubble. Capture and target behavior follows each event type's metadata.

Pointer payloads contain `clientX`, `clientY`, `button`, `buttons`, `detail`, modifier flags, `timeStamp`, and a bridge `targetId`. The target ID is resolved from GPUI hit testing or text-range hit testing and JavaScript maps it to the Retend node used as `event.target`. The v1 payload omits `screenX`, `screenY`, and `relatedTarget`.

## Event transport

Mouse-move events are coalesced before delivery to JavaScript so a busy JS thread does not accumulate a backlog of stale pointer positions. While a mouse-move delivery is pending, newer mouse-move events replace the pending payload with the latest pointer state rather than enqueueing every intermediate move. Discrete events such as mouse down/up/click are not coalesced by this rule and retain their ordering.

Rust sends events back to JavaScript as structured N-API objects rather than binary event buffers. Rendering mutations use the optimized binary transaction path, while reverse event delivery uses straightforward typed callbacks unless profiling later justifies specialization.

Retend GPUI nodes expose an EventTarget-compatible API but do not inherit from the built-in JavaScript `EventTarget` class. `addEventListener()`, `removeEventListener()`, and `dispatchEvent()` are implemented by Retend over its own listener registry so the renderer can implement logical capture/target/bubble propagation, listener snapshotting, native-subscription bookkeeping, and node-tree semantics directly. `node instanceof EventTarget` is not a compatibility goal.

For native-backed event types, listener registration follows connectivity. If `renderer.isActive(node)` is false, listener changes may remain batched with the node's ordinary pending native work. If `renderer.isActive(node)` is true, adding or removing the native-backed listener becomes effective synchronously. If the node became logically active before its pending UI transaction reached Rust, the host first flushes that transaction and then synchronizes the native subscription. No separate `nativeCreated`/`committed` lifecycle state is introduced for this purpose, and native subscription mechanics remain internal to the renderer/bridge.

For pointer and other targeted events, Rust resolves the native hit target and sends one structured event containing that target identity to JavaScript. Retend performs capture, target, and bubble propagation over the Retend parent chain. JavaScript snapshots the complete logical propagation path once before invoking listeners, so tree mutations during dispatch do not change the current event path.

For each node reached during dispatch, JavaScript snapshots that node's current listener list before invoking it, matching DOM semantics. Listeners added during that node's dispatch do not run for the current event, while listeners removed before their turn are skipped. Event objects support `stopPropagation()` and `stopImmediatePropagation()`.

Exceptions thrown by JavaScript event listeners are application errors rather than renderer/bridge failures. The dispatcher reports them through the normal Retend application/development error path, does not poison the renderer, and continues invoking the remaining applicable listeners unless propagation was explicitly stopped by event semantics.

Ordinary Retend GPUI events do not promise native `preventDefault()` semantics. GPUI native dispatch has completed before the event is delivered asynchronously to JavaScript, so a JS handler cannot retroactively cancel the native action. `preventDefault()` is only meaningful for a Retend-defined default action that itself executes on the JavaScript side.

## Imperative node API

Native-backed operations are exposed as methods on the appropriate Retend GPUI node objects rather than as standalone exported functions. Node property getters must remain JavaScript-local and must never perform native work implicitly.

Native commands that do not need to return native state to JavaScript are synchronous methods, for example `node.focus()`, `node.blur()`, or `node.scrollIntoView()`. Native queries use explicit verb-named methods and are asynchronous, for example `await node.measure()` or `await node.getSelection()`. Do not expose native-backed values through browser-style synchronous properties such as `offsetWidth`, `scrollTop`, or `selectionStart` when reading them would require consulting Rust/GPUI.

The API shape therefore communicates two distinctions: property access is local JS state, while method calls are operations; among methods, asynchronous return values are reserved for native queries that return state to JavaScript rather than being used merely as a generic indication that a call crossed the JS/Rust boundary.

Native queries are read barriers. Before a query executes, the host synchronously flushes that renderer's pending mutation queue, then orders the query after all earlier submitted native commands. Layout-dependent queries request and await a GPUI render/layout generation that contains that committed work. The implementation therefore needs an internal per-window render/layout fence or generation mechanism even though public transaction buffers do not carry sequence numbers. A mutation followed by `await node.measure()` observes that mutation, and `input.setSelectionRange(...)` followed by `await input.getSelection()` observes the submitted selection command. Callers do not need an explicit `renderer.flush()` merely to obtain read-after-write semantics.

The v1 layout/query surface includes `await node.measure()`, returning border-box `x`, `y`, `width`, `height`, `scrollWidth`, and `scrollHeight`, plus `await node.getScrollOffset()`. Client-box variants, per-line text rectangles, and `elementFromPoint` are outside the v1 surface.

A native query against a retained-but-detached node is valid. Layout-dependent reads such as `measure()` return a non-nullable zeroed bounds object while the node has no rendered box; once reattached and laid out, the same query returns current bounds again. Queries against permanently destroyed nodes reject with a developer error. If the renderer/window closes or the renderer becomes poisoned while a query is pending, that Promise rejects.

Synchronous native commands mean synchronous submission, not synchronous GPUI completion. Methods such as `node.focus()`, `node.blur()`, `node.scrollIntoView()`, and `input.setSelectionRange(...)` submit an ordered native command and return without waiting for the resulting GPUI/platform work to complete. The underlying execution path is platform-specific: macOS uses the main-thread GPUI/AppKit integration, while Windows/Linux may dispatch to a dedicated native UI thread. Command ordering is preserved relative to later commands and native queries, so a later query observes all earlier submitted commands in order. Calling a synchronous native command on a permanently destroyed node throws an immediate developer error; retained-but-detached nodes remain a separate valid state and follow each command's normal detached-node semantics.

## Focus ownership

Focus behavior follows GPUI rather than adding Retend-specific detach rules. A retained Rust node keeps its persistent `FocusHandle` while detached. GPUI may continue to store that handle as the window's focused handle even when the element is absent from the current rendered frame; while absent it is not present in the dispatch tree and does not receive normal focused-element keyboard/input routing. If the same node is rendered again with the same handle, GPUI recognizes it as focused again. Retend does not manually blur on detach or stage structural rendering solely to preserve focus.


Public focus navigation uses browser-style `tabIndex` rather than exposing GPUI-specific `tab_stop`/`tab_index` controls. Rust maps `tabIndex < 0` to a focusable handle that is skipped by sequential Tab navigation, and `tabIndex >= 0` to a GPUI tab stop with the corresponding tab index. Naturally interactive intrinsics such as text inputs receive their normal default Tab behavior when `tabIndex` is omitted, while plain containers do not.

Rust/GPUI owns authoritative focus state. JavaScript may request focus or blur for Retend nodes, but native focus handles, keyboard routing, IME integration, and other platform focus state remain in Rust. `node.blur()` uses browser-like semantics: Rust only calls `Window::blur()` when that node's `FocusHandle` is currently focused; calling `blur()` on an unfocused node is a no-op. Focus changes are reported back to JavaScript as events so Retend can observe and react without maintaining a second authoritative focus model.

Explicit focus requests on retained-but-detached nodes are forwarded directly to the node's persistent GPUI `FocusHandle`. GPUI may select that handle while the node is absent from the rendered dispatch tree, and it becomes operational again when the node is rendered with the same handle. Retend forwards GPUI focus-loss and focus-return notifications as they occur.

## Text input ownership and implementation

Rust owns live editing state for native text controls: current value, selection, caret, undo/redo state, and IME/composition state. Platform input is applied natively first and the resulting changes are reported to JavaScript as events. JavaScript does not participate in a synchronous round trip for each keystroke or composition update. An explicit later Retend `value` update remains authoritative as a programmatic overwrite of the current native value. If the incoming `value` string is identical to the current native editor value, Rust treats it as a no-op and does not disturb caret, selection, composition, or undo state; only a genuinely different string performs a programmatic replacement. A genuinely different programmatic value also wins immediately during an active IME composition: Rust replaces the editor contents and clears the current marked/composition range rather than deferring the overwrite until composition ends.

Programmatic text selection is part of the public input/textarea node API. Native commands `setSelectionRange(start, end, direction?)` and `select()` are synchronous. `getSelection()` is an asynchronous native query returning the current Rust-owned selection state. This follows the general imperative API rule: native commands are synchronous methods, native queries are asynchronous verb-named methods, and property getters never perform native work.

`input` and `textarea` use GPUI's `EntityInputHandler`/`ElementInputHandler` pattern for focus, IME, selection, mouse selection, marked ranges, and platform text-input integration. `input` is single-line; `textarea` adds multi-line wrapping and `minRows`/`maxRows` auto-sizing. Undo/redo uses a bounded native history with character-run coalescing.

Text-editing events use browser-like semantics. `input` fires whenever user editing changes the control value. `change` fires when an edited value is committed rather than on every keystroke; losing focus after the value changed commits the edit, and Enter commits a single-line `input`. IME composition lifecycle is exposed separately through `compositionstart`, `compositionupdate`, and `compositionend`, while the native editor remains authoritative for marked/composition state.

## Scroll ownership

Rust/GPUI owns live scroll state through persistent native scroll handles. Wheel and trackpad input update native scroll position directly without waiting for JavaScript. JavaScript may issue `scrollTo()`, `scrollBy()`, and `scrollIntoView()` commands and query `await node.getScrollOffset()`. A retained scrollable node keeps the same native `ScrollHandle` while detached, so reattaching that same node preserves its scroll offset. Permanent destruction releases the handle.

Scroll events are coalesced per node per frame with latest-wins semantics so JavaScript receives current state rather than a backlog of stale offsets. Smooth/animated scrolling is outside the v1 surface.

Overflow follows browser-style scroll-container semantics. `overflow: 'hidden'`, `'auto'`, and `'scroll'` are scroll-container states and retain the same persistent `ScrollHandle` and offset while switching among one another. `hidden` clips content, suppresses direct wheel/trackpad scrolling and scrollbars, but still permits programmatic scrolling through Retend commands such as `scrollTo()`, `scrollBy()`, and `scrollIntoView()`. `auto` and `scroll` both use GPUI scroll overflow internally; Retend's scrollbar policy distinguishes whether scrollbars appear only when needed or always. `overflow: 'visible'` and `'clip'` are not scroll-container states: entering either releases the active scroll state, and later returning to `hidden`, `auto`, or `scroll` creates a fresh `ScrollHandle` at the initial offset rather than restoring the old position. `clip` also forbids programmatic scrolling.

## Renderer/window binding

Closing a native window permanently invalidates its bound renderer. Rust destroys that window's entire retained native subtree as part of close, invalidates the binding, and any later transaction sent through that renderer is a developer error.


Each JavaScript renderer/host is permanently bound to one native window. Transactions are sent through that bound renderer, so the binary transaction buffer does not carry a window ID; the native bridge already knows the destination window from the bound renderer handle.

## Process lifetime

The native bridge keeps Node alive while native windows require the application process. Shutdown retains the final keep-alive through JavaScript application cleanup and releases it only when teardown is complete. Native threads alone do not provide Node process liveness.

## Window ownership

A single native GPUI application/process may own multiple native GPUI windows. Rust owns the authoritative native window registry, window IDs, and native window lifetimes. JavaScript holds lightweight window wrapper objects bound to those native IDs and sends commands such as create, close, resize, and set title; Rust reports window lifecycle and state changes back to JavaScript.

Each native window hosts an independent Retend root while sharing the same Node/application runtime. Native windows may survive a Vite full reload while the JavaScript application/module runtime is recreated and the Retend roots are remounted into those existing windows.

The v1 window surface includes create, close, resize, title updates, `closeWithOpener`, native resize events, per-window focus/blur, resizable state, fullscreen/maximized state, and minimum-size constraints where GPUI/platform support exists. Maximum-size constraints are implemented by the bridge using the platform support available on each target. Initial/move positioning and multi-monitor positioning APIs are outside the v1 surface.

## Node arena and window roots

Rust maintains one process-wide native node arena with globally unique node IDs. Each native GPUI window references its own root node ID within that shared arena rather than maintaining an independent per-window ID namespace.

## Cross-window node ownership

A native node belongs to exactly one window tree for its entire lifetime. Nodes and subtrees cannot be reparented across window roots. Moving UI between windows requires removing the old native nodes and creating corresponding nodes in the destination window.

## Group flattening and anchors

Groups are JavaScript-only structural containers and are flattened when appended or inserted, analogous to DOM `DocumentFragment` insertion. The renderer does not repeatedly call `collectNativeChildren()` to recursively flatten groups after each structural mutation; insertion resolves the concrete native nodes once and subsequent native operations address those nodes directly.

Anchors are represented in the retained native structure as empty structural text nodes so they have stable node identity and ordering. They must remain layout-neutral when converted to GPUI elements; do not rely on an empty GPUI text string being layout-neutral. Render them as GPUI `Empty`/otherwise omit them from layout while preserving their retained-tree position and identity.

## Root ownership and development errors

Each native window has one immutable native root for its lifetime. Retend does not switch the window between unrelated native roots, and the native protocol does not expose root replacement as a general rendering operation.

In development, the runtime owns a stable Retend wrapper tree beneath that native root. The user application is mounted as one subtree of that wrapper, and development UI such as compile/HMR error overlays is rendered as ordinary Retend components in the same component tree rather than as a separate native root. This follows Vite's web-client model: tooling UI is independent of the user's hot module, but it is still part of the rendered tree.

A recoverable HMR/compile error leaves the existing application subtree mounted while the dev overlay is shown. When a subsequent valid update succeeds, the overlay is removed and HMR continues. If the application entry never successfully loaded, the dev wrapper can still render the error UI because it is owned by the runtime rather than the broken entry module; once the entry becomes valid, the application subtree is mounted and the overlay is cleared.

## GPUI render model

Rust retains Retend-native node and render state as the authoritative native tree. For each affected native window render, `Render::render()` walks that retained state and constructs a fresh GPUI element tree. Stable Retend node IDs may be mapped to GPUI `ElementId`s where GPUI needs cross-frame element state; GPUI element instances themselves are not retained as the authoritative tree.

## Style updates and defaults

JavaScript resolves Retend-side reactivity and sends the complete current author-style snapshot for a node rather than per-property diffs. The snapshot contains only author-declared/resolved values; JavaScript does not inject GPUI defaults, Retend intrinsic defaults, or computed inherited values. Rust converts that sparse author style into native style refinements, applies Retend-native defaults where required, and relies on GPUI's default/refinement and inheritance machinery for the final effective style.

A Retend `div` defaults to block layout. Flex is opt-in with `display: 'flex'`. Root background and text color defaults are explicit Retend policy. Effective/computed style is not mirrored to JavaScript; native state is queried when required.

Static and transitioned `hover`/`active` styles are native-owned. JavaScript publishes reactive base/hover/active author-style snapshots. Rust owns current hover/pressed state, resolves precedence as `active > hover > base`, and applies immediate refinements or transition retargeting through the native motion state machine.

## Motion and pseudo-state transitions

Retend GPUI owns its transition engine in Rust. Per-node, per-property transition state such as current rendered value, target value, start time, duration, delay, and easing lives in the native GPUI render/event-loop context and advances with GPUI's frame cycle. JavaScript publishes author-style commits and never computes animation frames.

Retargeting, cancellation/snap behavior, and pseudo-state precedence live in the same native engine. The v1 animatable set is `width`, `height`, `top`, `right`, `bottom`, `left`, `opacity`, and `borderRadius`. Additional properties can be added through the native transition engine. `MOTION.md` defines the public transition semantics, including longhands, soft-fail behavior, retargeting from the visible value, initial-render behavior, and commit/coalescing boundaries.

## Text nodes

Text nodes are a distinct native node type in the binary protocol rather than an intrinsic element tag named `text`. Text creation uses a dedicated operation that includes the initial text payload, while later changes use a dedicated text-update operation.

## Authoritative UI tree

Rust owns the authoritative native UI tree.

JavaScript keeps only the Retend-side logical and reconciliation state required by the framework. It sends semantic mutations across the native boundary, while Rust owns native node identity, GPUI-facing retained state, event registration, layout/render state, animation state, and other platform-native state.

The architecture avoids duplicate authoritative representations of the same native UI state in JavaScript and Rust.

## Testing strategy

The protocol schema is the authoritative contract.

- A TypeScript reference interpreter decodes transactions, maintains a mirror tree, and exposes assertion helpers for fast renderer tests.
- Fixed golden byte vectors are asserted independently from TypeScript and Rust so matching encoder/interpreter bugs cannot silently redefine the wire format.
- Rust decoder/validator/tree tests cover the real native implementation headlessly, including malformed buffers, bounds validation, and fuzz/property coverage. Focused integration tests compare behavior with the reference interpreter.

## Migration strategy

The bridge is implemented in place within `retend-gpui`. The bridge, host, renderer, protocol, and reference interpreter are built within the package, validated against both the reference interpreter and real addon, and then become the sole renderer/host path. Examples and tests are ported to the v1 API as part of that migration.

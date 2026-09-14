# Native Bridge Architecture

This document defines the architecture, implementation model, and v1 scope for the Retend-owned GPUI native bridge. `MOTION.md` and `VITE.md` define detailed motion and development/runtime semantics where referenced.

## Distribution model

The Rust native bridge ships as an N-API addon with prebuilt per-platform binaries. Node remains the main process and GPUI is embedded through the addon. Packaging uses a main JavaScript package plus per-platform binary packages such as `darwin-arm64` and `linux-x64`.

Shipping applications use the appropriate platform application bundle around the runtime. The binary command protocol is independent of the embedding topology; the N-API bridge implementation itself is runtime-specific.

## Command-batch boundary

Synchronous native mutations accumulate in the JavaScript host queue and one queued microtask flushes them as a single ordered command batch. Explicit renderer/host `flush()` calls synchronously drain the current queue.

Command batches reduce N-API crossings, preserve mutation ordering, and give rendering one coherent notification boundary. They are not retained-tree rollback transactions. Rust decodes the complete binary buffer before mutation, then applies decoded commands directly and in order while holding the retained-tree lock. Each command validates all of its operands and invariants before changing retained state, so the failing command itself leaves no partial mutation. If a later command fails, the successfully applied prefix remains in the retained tree and Rust poisons the affected window before releasing the lock. A successful batch advances the window's committed retained-state generation and schedules the corresponding GPUI reconciliation/render work once. Retend reconciliation remains in JavaScript; Rust does not implement framework-level keyed or component reconciliation semantics.

## Boundary ownership

Retend GPUI uses a Retend-specific native bridge with a contract designed around Retend's renderer model. The bridge owns the JS/Rust boundary for mutation batching, events, windows, styles, motion, testing, and multi-window behavior.

## Platform threading and event loop

On macOS, AppKit/GPUI runs on the process main thread and the embedded bridge pumps the GPUI/AppKit event loop through the main-thread integration/tick model. On Windows and Linux, GPUI may run its blocking event loop on a dedicated native UI thread, with JavaScript communicating through the in-process bridge.

The public JS/native protocol is topology-independent. Command ordering, command-batch failure semantics, event delivery, renderer behavior, and multi-window behavior have the same contract whether GPUI work executes on the process main thread or a dedicated native UI thread.

## Command-batch application and threading

The N-API `applyCommandBatch(buffer)` call decodes the complete binary buffer before touching retained state. Unsupported versions, unknown opcodes, truncated values, corrupt indexes, invalid UTF-8, and other wire-format failures therefore leave the retained tree unchanged. After decoding, Rust acquires the retained-tree lock and applies commands directly in order. Each command performs every fallible reference, ownership, kind, cycle, and parentage check before mutation. Once a command begins changing retained state, its application has no expected failure path.

If every command succeeds, Rust releases the lock and schedules one dirty/render notification for the affected window. If a command fails, commands before it remain applied, the failing command makes no partial change, and Rust poisons that window while it still holds the lock. The window is invalidated so the fatal diagnostic surface replaces normal rendering; no retained-tree generation counter is needed merely to describe that transition.

The retained tree stores parsed Retend-native plain Rust data rather than GPUI-bound objects. Author-facing semantic strings are carried through the batch-local string table and parsed by Rust during command application; parsed values are stored so rendering does not repeatedly parse them. Property-level semantic parse failures follow their fail-soft rules and are not hard command failures.

The native GPUI execution context reads retained data and owns GPUI-bound runtime objects such as `FocusHandle`s, `ScrollHandle`s, text-input state, image state, and animation state keyed by stable node IDs. Command application may collect runtime-effect intents, but it does not install callbacks, create or destroy GPUI-bound objects, or perform other externally visible runtime work while a later command can still fail. Rust processes those effects only after the complete batch succeeds. On failure it discards them and enters the fatal path. On macOS the execution context is the process-main-thread GPUI/AppKit integration; on Windows and Linux it may be a dedicated native UI thread.

The retained tree and GPUI-bound runtime state have separate ownership. The command-batch path mutates retained plain data; the GPUI execution context owns live GPUI objects. Snapshot/locking strategy is an implementation detail that should be chosen from profiling rather than assumed up front.

Synchronous validation and submission do not imply synchronous visual completion. Native commands return after ordered submission; native queries wait for the native work needed to produce their result.

## Command-batch scope

Each native command batch targets exactly one native window. An application update that affects multiple windows is split into separate per-window batches. Their ordering, success, failure, poisoning, and render scheduling remain independent; there is no process-wide batch or commit spanning multiple windows.

## Command-batch failures

A hard command failure is a fatal Retend GPUI renderer bug, not a recoverable application error. Hard failures include invalid node references, cross-window references, duplicate live IDs, structural cycles, broken parentage, unsupported commands, and other JS/Rust contract violations. Wire-format failures happen before mutation. A hard failure during command application leaves the valid prefix applied, makes no partial change for the failing command, and poisons the affected native window before Rust releases the retained-tree lock or returns to JavaScript.

Rust synchronously returns structured failure details to JavaScript after native poisoning is established. JavaScript catches the failure at the renderer/host boundary, captures a JavaScript stack trace, and sends one dedicated out-of-band fatal diagnostic update to Rust. That command attaches the JavaScript stack to the already-poisoned native failure and remains available specifically for this diagnostic path.

Once poisoned, the renderer accepts no further normal mutations, command batches, settlement calls, imperative commands, events, or queries. Rust stops normal Retend rendering for that binding and presents a native fatal diagnostic surface containing both the native command failure and the JavaScript stack. The applied command prefix is retained only for teardown and diagnostics. No rollback, retry, tree reconstruction, or best-effort continuation is attempted. Closing or replacing the poisoned binding destroys every retained node and GPUI-bound runtime object owned by that window, including attached, detached, and never-attached nodes created before the failure.

In development, the native fatal screen may expose a manual Reload action. Reload tears down the poisoned JavaScript renderer/application binding and all of its retained/runtime state, then creates a fresh binding for the same existing native window; it does not recreate the OS window. A native window that has actually closed remains permanently invalid and cannot be rebound.

## Semantic application-value errors

A structurally valid command is not rejected merely because an application supplied a semantically invalid style value. Malformed protocol data, invalid node references, unsupported opcodes, corrupt indexes, and other JS/Rust contract violations remain fatal renderer bugs. By contrast, property-level parse failures such as an invalid color, length, or transition declaration fail soft according to that property's semantics and do not poison the renderer. Fatal command failure is reserved for protocol/invariant violations rather than ordinary bad application input.

## Command ordering

Command batches do not carry an explicit public revision or sequence number. The synchronous bridge and renderer-local queue preserve submission order. Dirty scheduling therefore does not require a retained-tree generation counter. Later imperative queries add only the explicit native completion/read barriers they actually need rather than pre-allocating revision bookkeeping in the retained model.

## Binary protocol

Command batches cross the JavaScript/Rust boundary as one custom compact binary buffer rather than structured N-API values or JSON. The protocol uses fixed opcodes and primitive encodings tailored to Retend GPUI instead of a generic serialization library.

The buffer header contains a small protocol version. Rust rejects unsupported versions so JavaScript/native mismatches fail explicitly rather than being decoded as malformed commands. Until the first Retend GPUI protocol ships, the version-1 schema is a development schema: numeric IDs and wire layouts may change freely as the protocol is designed, provided the generated JavaScript and Rust artifacts stay synchronized. A shipped protocol version establishes the compatibility boundary for subsequent wire changes.

Known protocol vocabulary such as opcodes, element kinds, property names, event types, and other fixed symbols use static numeric IDs rather than strings. Those numeric assignments have one authoritative machine-readable protocol schema. Phase 1 generates matching TypeScript and Rust constants from that schema rather than maintaining the numeric tables independently. The current fixed command surface keeps its typed TypeScript writer methods and compact Rust decoder table handwritten because generating them would add more schema/generator machinery than it removes; broader command scaffolding generation should be introduced only if later protocol growth makes it a net simplification. Semantic validation and retained-tree behavior remain handwritten. The custom Retend binary protocol remains the wire format.

Structural insertion uses one fixed-schema `INSERT_CHILD(parentId, childId, beforeId)` opcode rather than separate append, insert-before, and move opcodes. A nonzero `beforeId` inserts or moves `childId` immediately before that existing child of `parentId`; `beforeId = 0` means append at the end. Node ID `0` is reserved by the protocol and is never a valid real node ID. Removal uses `REMOVE_CHILD(parentId, childId)`. The same insertion operation therefore covers first attachment, reattachment, same-parent reordering, and ordinary moves without introducing separate structural wire concepts.

Each command batch contains its own string table. Dynamic strings are encoded once per batch and operations reference compact string-table indexes. The table is batch-local; there is no persistent cross-batch string interning state.

On the JavaScript side, command bytes and string-table bytes are built in separate growable regions. At flush time, the host allocates one final contiguous command-batch buffer sized for the header, command stream, and string table, then copies the two regions into `HEADER → COMMANDS → STRING TABLE` order and fills the header offsets/counts. This keeps encoding simple and makes the final native payload contiguous without relying on repeated relocation or backpatching of a single growing buffer.

The command-batch layout is `HEADER → COMMAND STREAM → STRING TABLE`. The header records the command-stream extent plus the string-table offset and count, allowing Rust to validate table bounds once and resolve string indexes directly while decoding commands.

Commands use fixed opcode-specific schemas with no per-command byte length. The decoder determines each payload shape from its opcode. Unknown opcodes, truncated payloads, and malformed fixed-schema payloads are fatal protocol errors.

## Property value encoding

Property updates use one small generic tagged wire representation rather than property-specific binary layouts. The wire carries the property ID plus a primitive value kind such as number, boolean, string-table reference, or removal/null, followed by that kind's fixed payload. The property ID determines the semantic interpretation in Rust, not the physical wire shape.

The public Retend GPUI style API uses a React-Native-like hybrid authoring model optimized for concise JavaScript/TypeScript. Bare numbers represent pixel-like numeric values where appropriate; simple closed vocabularies use constrained string literals such as `display: 'flex'`, `flexDirection: 'column'`, and `overflow: 'hidden'`; familiar textual forms such as percentage lengths and colors may remain concise author-facing values where appropriate. TypeScript types constrain these values so ordinary invalid keywords are rejected statically. Helpers/typed constructors are reserved for values that genuinely benefit from structure rather than being required for every keyword.

The JavaScript encoder stays intentionally lightweight. It serializes values according to their ordinary runtime shape rather than implementing a CSS-like semantic parser or normalizer. Numbers and booleans cross as native numeric/boolean fields; author-facing strings such as `'flex'`, `'50%'`, `'#fff'`, `'200ms'`, or `'ease-out'` cross through the batch-local string table. Fixed protocol vocabulary such as property IDs, element kinds, event types, and opcodes still uses static numeric IDs.

Rust owns semantic style decoding. During command application it interprets each property's incoming value according to that property's schema, parses textual semantic values where needed, converts them into parsed Retend-native representations, and stores those parsed values so GPUI rendering does not repeatedly reparse them. Property-level parse failures remain fail-soft application-value errors rather than protocol failures.

`MOTION.md` values such as CSS-style durations and timing functions remain concise author-facing strings and are parsed natively. The style API is specific to `retend-gpui`; other Retend renderers define their style surfaces independently.

## Node identity

JavaScript allocates stable node IDs before sending command batches and owns the process-lifetime non-reuse guarantee. Rust treats those IDs as cross-boundary handles, rejects collisions with currently live nodes or duplicate creates in one batch, and remains the owner of the actual native nodes. Rust does not retain tombstones for destroyed IDs merely to revalidate the JavaScript allocator.

Node IDs are globally unique across the process and are never reused after deletion. Node ID `0` is permanently reserved as the null/sentinel ID and is never allocated to a real node. JavaScript allocates real node IDs monotonically from the remaining `u32` space starting at `1`; stale references therefore cannot accidentally resolve to a later node that reused the same ID. Allocation is owned by one process-scoped JavaScript runtime singleton shared by every renderer/window. Renderer replacement, application remounts, and development full reloads continue using the same allocator; it resets only when the Node process exits.

## Detached node lifetime

Native nodes may be temporarily detached while Retend restructures the tree, including moves performed by `Unique`. Rust tracks this directly from its authoritative parent/child tree: whenever an existing node is removed from its parent and left parentless, that node becomes a pending-detached root, even if its former parent was already pending-detached; reinsertion removes that node from the set. Pending-detached nodes remain fully mutable before settlement: text, style, listener, custom-property, and subtree mutations are valid and are preserved if the node is reattached. Settlement is not encoded as an opcode in the UI command-batch protocol. The JavaScript host exposes a renderer-scoped `settle()` lifecycle operation that synchronously flushes all pending UI mutations for that renderer/window and then invokes the separate native `settle()` call.

Permanent destruction is deferred until the next JavaScript turn after a structural removal. `retend:activate` is not itself a sufficient destruction boundary: Retend retained-node machinery such as `Unique` can still schedule restoration/move work in microtasks associated with the same update. The renderer therefore allows those microtasks to complete before deciding which parentless nodes are permanently detached. At that deferred boundary, JavaScript marks its corresponding logical nodes destroyed and calls native `settle()`; Rust recursively destroys every root still in the pending-detached set. Newly created nodes that have not yet been attached are not considered pending-detached merely because their parent is null. This prevents nested detached subtrees from being orphaned or leaked and keeps lifecycle control separate from ordinary UI mutation encoding.

## Integer widths

Node IDs and batch-local string-table indexes are encoded as fixed unsigned 32-bit integers. The protocol does not use varints or narrower index widths; predictable decoding and one integer convention are preferred over marginal buffer-size savings.

## Stale native events

Native events cross from the GPUI/native event loop to Node's JavaScript thread asynchronously. If an event arrives in JavaScript for a node ID that has already been destroyed, JavaScript silently discards the event. If the target node still exists but is no longer attached under the active renderer root when JavaScript begins dispatch, the event is also discarded; retained identity alone does not make a detached node interactive. Because node IDs are never reused within the process, a stale event cannot target a later node with the same ID.

## Intrinsic element set

The currently supported JSX intrinsic set is `div`, `anchored`, `img`, `input`, and `textarea`.

Text is content rather than a JSX intrinsic. String children become dedicated native text nodes in the protocol and render through GPUI's `Text` element using the stable Retend node ID as the GPUI `ElementId`; a coalesced run uses its first node's ID. `input` and `textarea` use the persistent native editor/focus/selection state implemented in Phase 3. Scrolling is expressed through `overflow` on container elements rather than a dedicated scroll intrinsic. Unsupported intrinsic tags produce a descriptive render-time error. Additional element kinds can be activated through the versioned numeric protocol vocabulary when their owning phase is implemented.

### Anchored floating layers

`anchored` is a retained native node whose children remain in the ordinary Retend logical tree while GPUI controls their floating placement. The renderer lowers it to `gpui::anchored()` and, by default, `gpui::deferred()`: no JavaScript measurement or position-feedback loop is involved. `side` plus `align` selects the parent-relative anchor slot, `gap` and `offset` adjust that placement, and an explicit `position={{ x, y }}` switches to window-coordinate placement. Point-valued properties (`position` and `offset`) cross the bridge as one atomic protocol value rather than paired scalar mutations. `fit="snap"` uses GPUI's window-edge snapping with `snapMargin`; `fit="switch"` leaves GPUI's anchor-switching collision behavior active. Deferred priority and hit-test occlusion are exposed through `priority`, `deferred`, and `occlude`. GPUI requires the direct anchored child to be margin-free, so Retend rejects `margin*` styles on `<anchored>`; callers use `gap`/`offset` or an outer wrapper for spacing. The anchored node's author style and events apply to the floating content itself, and measured bounds describe the final floating surface rather than the zero-sized positioning slot.

### Image handling

`img` delegates loading, decoding, caching, intrinsic image metadata, and rendering to GPUI's image system. The current native bridge accepts HTTP(S) `src` URLs only. Bundled or relative asset paths are not part of the Phase 2 image surface; `VITE.md` defines the later production asset pipeline that emits ordinary assets as bundle resources and resolves Vite asset imports against that resource directory. Rust stores the accepted URL and parsed `objectFit` value as Retend-native image state. `null` removes the source; a non-string/non-null wire value is a renderer contract failure, while a string that is not a valid HTTP(S) URL fails soft as an invalid application value and leaves the source absent. A source update is reflected on the next fresh GPUI render. When `src` is absent or cleared, Retend still renders the same stable-ID GPUI `Img` with an empty custom source, preserving its styled layout participation and GPUI element identity without initiating a resource load. GPUI owns loading state, animation state, and shared resource caching, so Retend does not maintain or explicitly evict a second image cache when a node is destroyed.

### Text and mixed content

Each dedicated Retend text node retains its identity in the native tree, but adjacent text children are coalesced into a single GPUI `Text` element when their parent renders. GPUI lays out through taffy, which has no inline formatting context: separate `Text` elements always stack, so contiguous text nodes have to share one element to flow on one line and wrap as a run. This also mirrors CSS, where contiguous inline content forms a single anonymous box (or one anonymous flex item inside a flex container); `Count: {count}` renders on one line in both block and flex containers. Coalescing is presentational and recomputed on every render, so a reactive update to any node in the run rebuilds the merged text. GPUI owns text shaping, wrapping, accessibility, and inherited text styling.

Text inherits properties such as color, font family, font weight, and font size from its containing styled element. Non-text children separate runs: `<div>text <img/> more</div>` lowers to a text element, the image element, then another text element, and the parent lays those children out according to its configured GPUI display/layout style.

The v1 native renderer has no `span` or nested inline text-run model, so element children are never merged into a text run. Inline range styling and text-range event targeting are outside the v1 surface; introducing them later requires an explicit text-run abstraction rather than hidden range bookkeeping inside ordinary text rendering.

## Event vocabulary and payloads

The native protocol event vocabulary contains `click`, `dblclick`, `mousedown`, `mouseup`, `mouseenter`, `mouseleave`, `mousemove`, `keydown`, `keyup`, `input`, `change`, `focus`, `blur`, `scroll`, and the non-DOM extension `mousedownoutside`. JSX props keep React-style casing such as `onMouseDown`; protocol event names use their explicitly defined lowercase forms.

Application-defined custom events remain entirely in JavaScript and do not enter the native protocol vocabulary. Native event types carry propagation metadata. `mouseenter`, `mouseleave`, `focus`, `blur`, and element `scroll` are non-bubbling; ordinary pointer/button/key events such as `click`, `mousedown`, `mouseup`, `mousemove`, `keydown`, and `keyup` bubble. Capture and target behavior follows each event type's metadata.

Pointer payloads contain `clientX`, `clientY`, `button`, `buttons`, `detail`, modifier flags, `timeStamp`, and a bridge `targetId`. The target ID is resolved from GPUI hit testing or text-range hit testing and JavaScript maps it to the Retend node used as `event.target`. The v1 payload omits `screenX`, `screenY`, and `relatedTarget`.

## Event transport

Mouse-move events are coalesced before delivery to JavaScript so a busy JS thread does not accumulate a backlog of stale pointer positions. While a mouse-move delivery is pending, newer mouse-move events replace the pending payload with the latest pointer state rather than enqueueing every intermediate move. Discrete events such as mouse down/up/click are not coalesced by this rule and retain their ordering.

Rust sends events back to JavaScript as structured N-API objects rather than binary event buffers. Rendering mutations use the optimized binary command-batch path, while reverse event delivery uses straightforward typed callbacks unless profiling later justifies specialization.

Retend GPUI nodes expose an EventTarget-compatible API but do not inherit from the built-in JavaScript `EventTarget` class. `addEventListener()`, `removeEventListener()`, and `dispatchEvent()` are implemented by Retend over its own listener registry so the renderer can implement logical capture/target/bubble propagation, listener snapshotting, native-subscription bookkeeping, and node-tree semantics directly. `node instanceof EventTarget` is not a compatibility goal.

For native-backed event types, listener registration follows connectivity. If `renderer.isActive(node)` is false, listener changes may remain batched with the node's ordinary pending native work. If `renderer.isActive(node)` is true, adding or removing the native-backed listener becomes effective synchronously. If the node became logically active before its pending UI command batch reached Rust, the host first flushes that batch and then synchronizes the native subscription. No separate `nativeCreated`/`committed` lifecycle state is introduced for this purpose, and native subscription mechanics remain internal to the renderer/bridge.

For pointer and other targeted events, Rust resolves the native hit target and sends one structured event containing that target identity to JavaScript. Retend performs capture, target, and bubble propagation over the Retend parent chain. JavaScript snapshots the complete logical propagation path once before invoking listeners, so tree mutations during dispatch do not change the current event path. `mousedownoutside` is the exception: Rust selects each subscribed node whose subtree does not contain the hit target and emits a separate target-only event for that subscriber; JavaScript does not capture or bubble that extension through ancestors.

For each node reached during dispatch, JavaScript snapshots that node's current listener list before invoking it, matching DOM semantics. Listeners added during that node's dispatch do not run for the current event, while listeners removed before their turn are skipped. Event objects support `stopPropagation()` and `stopImmediatePropagation()`.

Exceptions thrown by JavaScript event listeners are application errors rather than renderer/bridge failures. The dispatcher reports them through the normal Retend application/development error path, does not poison the renderer, and continues invoking the remaining applicable listeners unless propagation was explicitly stopped by event semantics.

Ordinary Retend GPUI events do not promise native `preventDefault()` semantics. GPUI native dispatch has completed before the event is delivered asynchronously to JavaScript, so a JS handler cannot retroactively cancel the native action. `preventDefault()` is only meaningful for a Retend-defined default action that itself executes on the JavaScript side.

## Imperative node API

Native-backed operations are exposed as methods on the appropriate Retend GPUI node objects rather than as standalone exported functions. Node property getters must remain JavaScript-local and must never perform native work implicitly.

Native commands that do not need to return native state to JavaScript are synchronous methods, for example `node.focus()`, `node.blur()`, or `node.scrollIntoView()`. Native queries use explicit verb-named methods and are asynchronous, for example `await node.measure()` or `await input.getSelection()`. Imperative methods live on the narrowest applicable node class: generic element operations stay on `GpuiElement`, while text-selection methods exist only on native text-control subclasses such as `GpuiInputElement`/`GpuiTextareaElement`. Do not expose native-backed values through browser-style synchronous properties such as `offsetWidth`, `scrollTop`, or `selectionStart` when reading them would require consulting Rust/GPUI.

The API shape therefore communicates two distinctions: property access is local JS state, while method calls are operations; among methods, asynchronous return values are reserved for native queries that return state to JavaScript rather than being used merely as a generic indication that a call crossed the JS/Rust boundary.

Native queries are read barriers. Before a query executes, the host synchronously flushes that renderer's pending mutation queue, then orders the query after all earlier submitted native commands. Layout-dependent queries request and await a GPUI render/layout generation that contains that committed work. The implementation therefore needs an internal per-window render/layout fence or generation mechanism even though public command-batch buffers do not carry sequence numbers. A mutation followed by `await node.measure()` observes that mutation, and `input.setSelectionRange(...)` followed by `await input.getSelection()` observes the submitted selection command. Callers do not need an explicit `renderer.flush()` merely to obtain read-after-write semantics.

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

Programmatic text selection is part of the public input/textarea node API. Native commands `setSelectionRange(start, end)` and `select()` are synchronous. `getSelection()` is an asynchronous native query returning the current Rust-owned `{ start, end }` selection. This follows the general imperative API rule: native commands are synchronous methods, native queries are asynchronous verb-named methods, and property getters never perform native work.

`input` and `textarea` are backed by `gpui-base`'s native input engine, which implements GPUI's `EntityInputHandler`/`ElementInputHandler` pattern for focus, IME, selection, mouse selection, marked ranges, platform text-input integration, and bounded/coalesced undo history. Retend does not duplicate that editor state; its adapter owns only retained node association, controlled-value reconciliation, imperative bridge commands, and event translation. `input` is single-line; `textarea` adds multi-line wrapping and `minRows`/`maxRows` auto-sizing.

Text-editing events use browser-like semantics. `input` fires whenever user editing changes the control value and carries the authoritative native value. `change` carries that same authoritative value when an edited value is committed rather than on every keystroke; losing focus after the value changed commits the edit, and Enter commits a single-line `input`.

## Scroll ownership

Rust/GPUI owns live scroll state through persistent native scroll handles. Wheel and trackpad input update native scroll position directly without waiting for JavaScript. JavaScript may issue `scrollTo()`, `scrollBy()`, and `scrollIntoView()` commands and query `await node.getScrollOffset()`. A retained scrollable node keeps the same native `ScrollHandle` while detached, so reattaching that same node preserves its scroll offset. Permanent destruction releases the handle.

Scroll events carry the authoritative native `scrollX`/`scrollY` offset captured when the change is detected. They are coalesced per node per frame with latest-wins semantics so JavaScript receives current state rather than a backlog of stale offsets. Smooth/animated scrolling is outside the v1 surface.

Overflow follows browser-style scroll-container semantics. `overflow: 'hidden'`, `'auto'`, and `'scroll'` are scroll-container states and retain the same persistent `ScrollHandle` and offset while switching among one another. `hidden` clips content, suppresses direct wheel/trackpad scrolling and scrollbar UI, but still permits programmatic scrolling through Retend commands such as `scrollTo()`, `scrollBy()`, and `scrollIntoView()`. `auto` and `scroll` both use GPUI scroll overflow internally and reuse `gpui-base`'s generic `Scrollbar` against that same retained handle: `auto` uses the activity-driven `Scrolling` mode, while `scroll` uses `Always`. An axis with no actual overflow is omitted by the native scrollbar even in `scroll` mode. `overflow: 'visible'` and `'clip'` are not scroll-container states: entering either releases the active scroll state, and later returning to `hidden`, `auto`, or `scroll` creates a fresh `ScrollHandle` at the initial offset rather than restoring the old position. `clip` also forbids programmatic scrolling.

## Renderer/window binding

Closing a native window permanently invalidates its bound renderer. Rust destroys that window's entire retained native subtree as part of close, invalidates the binding, and any later command batch sent through that renderer is a developer error.

Each JavaScript renderer/host is permanently bound to one native window. Command batches are sent through that bound renderer, so the binary mutation buffer does not carry a window ID; the native bridge already knows the destination window from the bound renderer handle.

## Process lifetime

The native bridge keeps Node alive while native windows require the application process. Shutdown retains the final keep-alive through JavaScript application cleanup and releases it only when teardown is complete. Native threads alone do not provide Node process liveness.

## Window ownership

A single native GPUI application/process may own multiple native GPUI windows. Rust owns the authoritative native window registry, window IDs, and native window lifetimes. JavaScript holds lightweight window wrapper objects bound to those native IDs and sends commands such as create, close, resize, and set title; Rust reports window lifecycle and state changes back to JavaScript.

Each native window hosts an independent Retend root while sharing the same Node/application runtime. Native windows may survive a Vite full reload while the JavaScript application/module runtime is recreated and the Retend roots are remounted into those existing windows.

The v1 window surface includes create, close, resize, title updates, `closeWithOpener`, native resize events, per-window focus/blur, initial resizable and fullscreen/maximized creation state, and minimum-size constraints where GPUI/platform support exists. Maximum-size constraints are enforced by the bridge on ordinary windowed resize events using the platform resize support available on each target. Initial/move positioning and multi-monitor positioning APIs are outside the v1 surface.

## Node arena and window roots

Rust maintains one process-wide native node arena with globally unique node IDs. Each native GPUI window references its own root node ID within that shared arena rather than maintaining an independent per-window ID namespace.

## Cross-window node ownership

A native node belongs to exactly one window tree for its entire lifetime. Nodes and subtrees cannot be reparented across window roots. Moving UI between windows requires removing the old native nodes and creating corresponding nodes in the destination window.

## Group flattening and anchors

Groups and range anchors are JavaScript-only structural nodes. Groups provide logical ownership without a native layout container, while anchors delimit stable Retend ranges for `If`, `For`, `Await`, HMR boundaries, and other incremental updates. Neither kind crosses N-API or receives a native node ID.

JavaScript keeps groups and anchors in its logical tree but skips them when issuing native mutations. Insertions, moves, and removals are emitted incrementally for native-backed nodes, so Rust retains only nodes with native rendering or runtime meaning.

## Root ownership and development errors

Each native window has one immutable native root for its lifetime. JavaScript owns a logical `GpuiRoot` with no native ID and projects its native-backed children directly beneath that immutable root. Application output therefore does not gain an implicit `div` or any other layout-bearing wrapper merely because it returns text, a fragment, or multiple top-level nodes.

Recoverable development UI is renderer-owned and remains outside the application's Retend tree. A compile/HMR error adds an overlay above the still-mounted application subtree, preserving application state and native attachment. Clearing the error removes only that overlay. The overlay can also be presented before an application root has mounted because it does not depend on the broken application module.

Event stale-target checks still use native attachment rather than treating `renderer.isActive()` as equivalent to native visibility.

## GPUI render model

Rust retains Retend-native node and render state as the authoritative native tree. For each affected native window render, `Render::render()` walks that retained state and constructs a fresh GPUI element tree. Stable Retend node IDs may be mapped to GPUI `ElementId`s where GPUI needs cross-frame element state; GPUI element instances themselves are not retained as the authoritative tree.

## Style updates and defaults

JavaScript resolves Retend-side reactivity and sends the complete current author-style snapshot for a node rather than per-property diffs. The snapshot contains only author-declared/resolved values; JavaScript does not inject GPUI defaults, Retend intrinsic defaults, or computed inherited values. Each snapshot replaces the previous sparse author style atomically, so omitting a declaration removes it without a separate removal command. Rust converts that sparse author style into native style refinements, applies Retend-native defaults where required, and relies on GPUI's default/refinement and inheritance machinery for the final effective style.

A Retend `div` defaults to block layout. Flex is opt-in with `display: 'flex'`. Phase 2's static native style surface covers flex direction/wrapping/alignment, gaps, dimensions, padding/margins, relative/absolute positioning, colors/opacity, borders, and basic inherited text style. Overflow/scroll state is Phase 3 and transition/pseudo-state state is Phase 4. Root background and text color defaults are explicit Retend policy. Effective/computed style is not mirrored to JavaScript; native state is queried when required.

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

The protocol schema is the authoritative contract. Early implementation is validated directly through focused TypeScript encoder tests plus Rust decoder/validator/tree tests. Coverage includes malformed buffers and bounds failures before mutation, per-command validation before mutation, valid-prefix retention after a later hard failure, immediate native poisoning, isolation of unaffected windows, teardown of every node owned by a poisoned window, and fuzz/property testing. This keeps Phase 1 focused on proving the real JS → Rust → retained-tree path rather than requiring a second complete implementation before the command surface has stabilized.

After the core protocol has been exercised by the renderer and its command vocabulary is stable, protocol hardening adds fixed golden byte vectors asserted independently by the TypeScript writer and Rust decoder. Real-addon integration tests continue to validate the complete TypeScript → binary protocol → Rust retained-tree path, while Rust fuzz/property tests cover malformed and adversarial decoder inputs. These layers protect the mature wire contract without maintaining a second retained-tree implementation solely for testing.

## Migration strategy

The bridge is implemented in place within `retend-gpui`. The bridge, host, renderer, and protocol are built within the package, validated through focused writer/decoder tests and the real addon, and then become the sole renderer/host path. Examples and tests are ported to the v1 API as part of that migration.

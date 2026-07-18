# Retend hydration implementation

## Scope and compatibility

This document describes the hydration implementation in the current working tree. It also compares it with the implementation removed by `e065266`; Git history was consulted for that comparison only after the original no-history constraint was lifted.

The implementation preserves Retend's public component APIs. In particular:

- `If` still accepts exactly three arguments.
- `useAwait().finished` is still a `Promise<void>`.
- there is no exported hydration error type, Teleport status value, disposal hook, structural-range helper, or path helper;
- no DOM or hydration type was added to the core renderer contract;
- `StateSnapshot.data` was already an opaque renderer-data slot. Hydration uses that existing slot without changing its public shape.

Retend continues to support one active application context per JavaScript realm. A new hydration transaction replaces that context and disposes the previous hydration transaction. Overlapping calls to `hydrate` are rejected instead of being allowed to corrupt the global context; concurrent independent Retend applications in one realm are not presented as a supported feature.

## Why the old implementation was removed

The old hydrator did not primarily match the server tree by structure. The server classified selected nodes as dynamic, generated hierarchical `data-dyn` identifiers, and serialized those identifiers into HTML. The client repeated the classification and identifier-generation process, scanned the DOM into a lookup table, and tried to join the two executions by ID.

That required several recovery mechanisms:

- `Skip` objects stood in for server nodes the client chose not to recreate;
- `DeferredHandleSymbol` represented ranges whose real anchors were not yet known;
- range anchors could be synthesized after the fact;
- dynamic classification depended on props, events, cells, refs, children, and renderer state;
- branch counters and pending-hydration counters attempted to decide when hydration was finished;
- list reconciliation cleared unknown server content on its first pass.

The core problem was duplicated inference. The server and client separately guessed which nodes mattered and had to produce identical IDs despite async control flow. A successful lookup did not prove that the surrounding DOM was structurally correct, while recovery paths made incorrect matches appear usable.

The new implementation does not generate or consume `data-dyn`, does not classify elements as dynamic, and does not reconstruct missing ranges. Server and client instead share a small serialized grammar and consume it in document order.

## Serialized grammar

The server emits the following namespaced comment records:

| Record          | Serialized comment             | Purpose                                                              |
| --------------- | ------------------------------ | -------------------------------------------------------------------- |
| Range start     | `<!--retend:range-start-->`    | Opens a dynamic group handle.                                        |
| Range end       | `<!--retend:range-end-->`      | Closes a dynamic group handle.                                       |
| Text separator  | `<!--retend:text-separator-->` | Prevents adjacent text nodes from being merged by HTML parsing.      |
| Empty text      | `<!--retend:empty-text-->`     | Preserves an explicit empty reactive text slot.                      |
| Teleport anchor | `<!--retend:teleport:<id>-->`  | Associates a source position with its serialized Teleport container. |

Every renderer group is represented by a real start/end pair. The grammar is intentionally namespaced so ordinary one-character comments cannot accidentally become framework control records.

The SSR root receives `data-retend-hydration="1"`. The client uses this single attribute to choose hydration. Without it, the same entry point performs a fresh client render.

## The core renderer-neutral change

Hydration needs a dynamic range to exist before rendering the range's children. Otherwise the DOM renderer cannot enter the corresponding server range before `handleComponent` starts asking for elements and text.

`If`, `For`, `Switch`, and `Unique` therefore now follow the same renderer-neutral order:

1. create a group;
2. create its handle;
3. place that handle in the existing opaque `StateSnapshot.data` slot passed to `renderer.handleComponent`;
4. render the initial content;
5. commit the content through `renderer.write` or `renderer.reconcile`.

This ordering makes equal sense for the DOM renderer and the virtual DOM renderer. It does not mention the web, comments, or hydration. It also removes the former special initial path where synchronous content was linked into a group before the handle existed.

`Await` owns its group directly. It does not pass a hidden fourth argument to `If`, use a cross-module WeakMap, or add a public range property. It renders its children once to discover async dependencies, renders the fallback under a separate lifecycle branch when necessary, and writes either result into its own handle.

Effect nodes gained one internal immediate-disposal registration method. This is required because setup cleanup is too late for a branch removed before setup activation. It has renderer-neutral lifecycle semantics: a logical branch can be disposed whether or not its setup effects ever ran. No public `onDispose` hook is exported.

## Hydration state in `DOMRenderer`

`DOMRenderer` owns all web-specific hydration state. The important structures are:

- `#hydrationStack`: structural cursor frames for the root, elements, and ranges;
- `#hydrationRangeEnds`: precomputed start-to-end range pairing;
- `#unclaimedHydrationRanges`: entered ranges which no group handle has claimed;
- `#claimedNodes`: server nodes accepted by the client render;
- `#claimedPositions`: original positions used when claimed nodes move;
- `#fragmentChildren`: logical children of document fragments whose real DOM nodes remain connected;
- `#hydrationHandleFrames`: the structural frame belonging to each renderer handle;
- `#initialHydrationWrites`: handles which have not committed their first write;
- `#deferredHydrationWrites`: deliberate client content which must wait until the structural walk is finished;
- `#pendingHydrationTeleports`: Teleport mounts coordinated at finalization.

`enableHydrationMode(root)` initializes those structures and scans the root plus existing shadow roots once to pair range comments. It does not scan `document` for dynamic nodes or pre-register document-wide Teleport containers.

## Structural claiming

When hydration is active, creation operations claim server nodes rather than create replacements.

### Elements

`createContainer` claims the next child only if node type, local name, and namespace match. A structural mismatch throws immediately. The wrong node is not marked, the cursor is not advanced, and no property or child mutation is attempted on it.

If the element has children, the renderer pushes a child frame. SVG, MathML, HTML, foreign-object namespace changes, and shadow roots use the same structural rule.

### Text

`createText` claims the next text node. An empty-text marker is replaced by a real empty `Text` node because HTML cannot otherwise round-trip that slot.

A resolved content mismatch throws immediately without overwriting the server text or allowing later nodes to be mutated. Pending async text is not compared until it becomes authoritative. Reactive text whose server value matches is reused and remains connected to its cell listener.

### Raw HTML

`dangerouslySetInnerHTML` owns an opaque subtree: Retend does not render or claim the descendants individually. Immediately after structurally claiming the element, and before applying any properties, hydration compares resolved client HTML with the server element's existing `innerHTML`. A mismatch therefore throws before classes, refs, listeners, reactive attributes, or raw children can mutate. A match leaves `innerHTML` untouched, preserving the server-created descendants, and excludes that opaque subtree from the descendant ownership audit. Reactive updates still use the normal property listener after hydration.

### Dynamic ranges

`createGroupHandle` claims the next immediate range. It verifies that any fragment children already produced for that handle were themselves claimed, records the range's server children as the logical fragment contents, and advances the parent cursor past the end marker.

Components rendered with a snapshot handle temporarily enter that handle's frame. If the server range is empty, initial client content is rendered speculatively with hydration disabled and its write is deferred. A genuine client update during hydration is likewise rendered as new client DOM, rather than incorrectly trying to claim server nodes a second time.

### Writes and lists

An initial write containing the exact claimed nodes becomes a normal renderer write; the low-level DOM operation exits early when the nodes are already in the same order. This preserves identity, focus, selection, and connection state.

An initial empty or client-created result is deferred. At finalization it is explicitly classified as a client update, committed, and included in the final ownership audit. This is the point where a client value intentionally replaces server-only content.

`reconcile` validates every proposed list node before invoking the mutating reconciliation operation. A bad hydration cache therefore cannot remove, move, or dispose DOM before the ownership error is reported.

## Async boundaries and disposal

Every `Await` registers its initial completion in the realm's async-holder set. `waitForAsyncBoundaries` drains the set until it remains empty across a microtask, which also captures boundaries created by resolving other boundaries.

Initial completion races logical disposal. If a never-resolving boundary is removed before setup activation, disposal resolves its holder and prevents global async waiting from hanging. Disposal does not masquerade as successful completion: `finished` resolves as before, while the existing `done` flag remains false.

An uncommitted `Unique` instance records the `Await` that currently owns its pending render. Completion commits only if that owner and destination are still current. Cancellation removes an uncommitted instance; a later live destination supersedes the pending owner and renders into its own handle. A stale completion therefore cannot poison the stash, write into a moved handle, or steal a subsequent destination. The public Await context did not need a boolean result or another property.

At the client and server entry points, async work and Teleport mounting are coordinated in waves. A wave processes the currently queued work once, yields to `waitForAsyncBoundaries`, and then retries deferred work. Two consecutive no-progress waves constitute an unresolved target. There is no inner busy retry loop competing with an outer async wait.

## Teleports

Client-only rendering generates a Teleport ID and serializes it on both the source anchor and `retend-teleport` container.

Hydration does not match a server Teleport using the client counter. It structurally claims the next Teleport anchor and parses the serialized ID. The existing container is then looked up inside the requested target and claimed using that ID. Only a successfully claimed container is added as an additional hydration root.

This has three consequences:

- different async resolution order on server and client does not reassign serialized Teleport identity;
- hydration does not perform a document-wide fallback claim;
- a missing target may be deferred without logging a false error on every retry.

Teleport mounts are processed sequentially while hydrating because they temporarily use the renderer's structural cursor. A disconnected or disposed source returns a cancellation sentinel and removes its matching stray container when present. Normal client mounting still emits a diagnostic for a conclusively missing target.

## Hydration finalization

`endHydration` performs the following sequence:

1. mount pending Teleports sequentially, yielding to async boundaries between waves;
2. commit deferred initial writes as client updates;
3. reject any range entered but never claimed by a handle;
4. recursively audit the main root, claimed Teleport roots, and shadow roots for unclaimed server nodes;
5. leave hydration mode;
6. run pending setup effects;
7. dispatch `hydrationcompleted`.

The audit is exhaustive for the roots owned by this hydration transaction. It does not treat arbitrary document content as owned.

## Client transaction and failure cleanup

`hydrate` creates a fresh `{ globalData, renderer }` context before constructing the application. The initial router location comes from `window.location.pathname + search + hash`, so no server-context JSON script is required.

The transaction retains the router's listener cleanup and the root effect node. A repeated call disposes the prior hydration transaction before installing the next one. If the first transaction fails, the new router listeners are detached, the failed effect tree is disposed, the preexisting context is restored, and the error is rethrown. If a replacement fails after disposing an earlier hydrated application, a clean neutral context is installed instead of restoring the already-disposed application.

For an unmarked root, the same transaction clears the root and performs a normal client render. It still waits for async boundaries and setup effects before dispatching `hydrationcompleted`.

## Failure policy

The implementation is deliberately strict:

- wrong structural node: throw immediately without claiming or mutating it;
- wrong list ownership: throw before reconciliation;
- wrong resolved text value: throw immediately without mutation;
- wrong resolved raw HTML: throw before assigning `innerHTML`;
- missing or unmatched range: reject;
- unclaimed server node or connected owned root: reject;
- unresolved Teleport after async progress is exhausted: reject.

It does not search outside the active structural context for a plausible replacement, reconstruct ranges, suppress router-wide hydration diagnostics, or silently clear unknown server DOM to make the test pass.

## Verification coverage

The final suite covers, among other cases:

- mutation-free element and text mismatches;
- matching raw HTML identity and mutation-free raw HTML mismatches;
- element, text, SVG, MathML, shadow-root, and reactive-attribute hydration;
- nested and sibling `If`, `For`, `Switch`, `Await`, and `Unique` ranges;
- pending initial `Await` disposal;
- server-only async content replaced before hydration completes;
- sibling Teleports resolving in opposite server/client order;
- Teleport targets created by later async work;
- repeated hydration and hydration after an earlier client render;
- overlapping hydration rejection and failed-replacement context cleanup;
- router-listener cleanup after rejection;
- list reconciliation ownership before mutation;
- focus and node identity across keyed reconciliation;
- explicit namespaced range, separator, empty-text, and Teleport serialization.

Final verification for this implementation:

- core build: passed;
- web build: passed;
- server build: passed;
- browser/runtime suite: 797 passed;
- Oxlint plugin suite: 11 passed;
- repository lint: 0 warnings, 0 errors;
- production docs build: passed;
- `/docs/getting-started` production preview: nine syntax-highlighted tokens retained, no console errors.

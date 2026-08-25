import type {
  EventPayload,
  TestGpuixRenderer,
  WindowOptions,
} from '@gpuix/native';
import type { JSX } from 'retend/jsx-runtime';

import {
  AsyncCell,
  Cell,
  SourceCell,
  branchState,
  createNodesFromTemplate,
  normalizeJsxChild,
  runPendingSetupEffects,
  setActiveRenderer,
  useAwait,
  withState,
  type __HMR_UpdatableFn,
  type Capabilities,
  type ReconcilerOptions,
  type Renderer,
  type RendererTypes,
  type StateSnapshot,
} from 'retend';

import type { GpuiElementType, GpuiStyle } from './types.js';

import { GpuiHost } from './gpui-host.js';
import { withHMRBoundaries } from './plugins/hmr.js';
import {
  GpuiAnchor,
  GpuiElement,
  GpuiGroup,
  GpuiNode,
  GpuiText,
  GpuiParentNode,
  type GpuiRange,
} from './tree/nodes.js';
import {
  appendNodes,
  collectNativeChildren,
  createRange,
  flattenGroups,
  getRangeNodes,
  writeRange,
  type StructureMutation,
} from './tree/operations.js';
import { GPUI_ELEMENT_TYPES, GPUI_EVENT_TYPES } from './types.js';

const EVENT_TYPES = new Set<string>(GPUI_EVENT_TYPES);
const UNIVERSAL_PROPS = new Set(['autoFocus', 'tabIndex', 'motion', 'testId']);
const IGNORED_PROPS = new Set([
  'children',
  'className',
  'key',
  'retend:collection',
]);
const NORMAL_FLOW_STYLE: GpuiStyle = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  alignContent: 'flex-start',
};
const ROOT_STYLE: GpuiStyle = {
  backgroundColor: '#ffffff',
  color: '#000000',
};

function eventTypeForProp(key: string): string | undefined {
  if (!key.startsWith('on') || key.length < 3) return;
  const eventType = key[2].toLowerCase() + key.slice(3);
  return EVENT_TYPES.has(eventType) ? eventType : undefined;
}

function hasAncestor(
  node: GpuiNode | null,
  predicate: (node: GpuiNode) => boolean
): boolean {
  for (let current = node; current; current = current.parent) {
    if (predicate(current)) return true;
  }
  return false;
}

/**
 * Options for constructing a {@link RetendGpuiRenderer}.
 */
export interface RetendGpuiRendererOptions {
  /**
   * When true, components are wrapped with HMR boundaries that allow
   * in-place hot updates via `hotReloadModule`. Enabled automatically
   * by the dev child runtime.
   */
  hmr?: boolean;
  /** Receives native window size changes. */
  onWindowSize?: (size: { width: number; height: number }) => void;
}

interface GpuiRenderingTypes extends RendererTypes {
  Node: GpuiNode;
  Handle: GpuiRange;
  Group: GpuiGroup;
  Text: GpuiText;
  Container: GpuiElement;
  Host: GpuiHost;
}

/**
 * Retend renderer backed by GPUiX's native retained tree.
 * Implements the `Renderer` interface from `retend` and translates JSX operations
 * into batched GPUiX mutations forwarded through {@link GpuiHost}.
 *
 * @example
 * ```tsx
 * import { RetendGpuiRenderer } from "retend-gpui";
 * const renderer = new RetendGpuiRenderer();
 * renderer.init({ title: "App", width: 800, height: 600 });
 * setActiveRenderer(renderer);
 * renderer.render(() => <div style={{ padding: 12 }}>Hello GPUI</div>);
 * ```
 */
export class RetendGpuiRenderer implements Renderer<GpuiRenderingTypes> {
  /** Host that batches mutations and drives the native frame loop. */
  readonly host: GpuiHost;
  /** Whether a Retend root is currently mounted in this renderer. */
  get hasRoot(): boolean {
    return this.#root !== null;
  }
  /** Capabilities advertised to the Retend reconciler. */
  readonly capabilities: Capabilities = {
    supportsConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  #nextId = 1;
  #state?: StateSnapshot;
  #root: GpuiElement | null = null;
  #nodesById = new Map<number, GpuiElement>();
  #pendingDestroy = new Set<GpuiNode>();
  #destroyTimer: ReturnType<typeof setTimeout> | null = null;
  #devErrorRoot: GpuiElement | null = null;
  #devErrorText: GpuiText | null = null;
  #disposed = false;
  readonly #hmr: boolean;

  /**
   * Creates a renderer.
   *
   * @param testNative - Optional test double that replaces the native `GpuixRenderer`.
   * @param options - Renderer behavior flags such as `hmr`.
   */
  constructor(
    testNative?: TestGpuixRenderer,
    options: RetendGpuiRendererOptions = {}
  ) {
    this.#hmr = options.hmr ?? false;
    this.host = new GpuiHost(
      {
        onEvent: (event) =>
          this.#runWithState(() => this.#dispatchNativeEvent(event)),
        onWindowSize: options.onWindowSize
          ? (size) => this.#runWithState(() => options.onWindowSize?.(size))
          : undefined,
      },
      testNative
    );
  }

  #runWithState<Value>(callback: () => Value): Value {
    return this.#state ? withState(this.#state, callback) : callback();
  }

  /**
   * Initializes the underlying host and native renderer.
   *
   * @param options - Native window options forwarded to `GpuiHost.init`.
   */
  init(options?: WindowOptions): void {
    this.host.init(options);
  }

  /**
   * Renders a JSX template as the root of the GPUI tree.
   * Must be called after `init` and only once per renderer instance.
   *
   * @param app - JSX template returned by the root component (e.g. `() => <App />`).
   * @returns The created logical node(s) for the template.
   * @throws If the host is not initialized, the renderer is disposed, or a root already exists.
   */
  render(app: JSX.Template): GpuiNode | GpuiNode[] {
    if (!this.host.isInitialized) {
      throw new Error(
        'RetendGpuiRenderer.init() must be called before render().'
      );
    }
    if (this.#disposed) {
      throw new Error('A disposed RetendGpuiRenderer cannot render again.');
    }
    if (this.#root) {
      throw new Error('RetendGpuiRenderer already has a root.');
    }

    this.#state = branchState();
    return withState(this.#state, () => {
      const result = normalizeJsxChild(app, this);
      const root = this.#materializeRoot(result);
      this.#root = root;
      this.#publishStyle(root);
      this.host.mutate('setRoot', root.id);
      this.host.flush();
      return result;
    });
  }

  /** Creates a logical group node with no native counterpart. */
  createGroup(): GpuiGroup {
    return new GpuiGroup();
  }

  /**
   * Creates a native element for an intrinsic tag.
   *
   * @param tagName - One of {@link GPUI_ELEMENT_TYPES} (e.g. `"div"`, `"code"`).
   * @returns The created `GpuiElement` and enqueues a `createElement` mutation.
   * @throws If the tag is not supported by GPUiX.
   */
  createContainer(tagName: string): GpuiElement {
    if (!GPUI_ELEMENT_TYPES.includes(tagName as GpuiElementType)) {
      throw new Error(`Unsupported GPUiX intrinsic element: <${tagName}>.`);
    }

    const node = new GpuiElement(this.#nextId++, tagName);
    this.#nodesById.set(node.id, node);
    this.host.mutate('createElement', node.id, tagName);
    return node;
  }

  /**
   * Creates a native text node.
   *
   * @param text - Initial text content.
   */
  createText(text: string): GpuiText {
    const node = new GpuiText(this.#nextId++, text);
    this.#nodesById.set(node.id, node);
    this.host.mutate('createElement', node.id, 'text');
    this.host.mutate('setText', node.id, text);
    return node;
  }

  /**
   * Updates the content of an existing text node.
   *
   * @param text - New text content.
   * @param node - Target text node.
   * @returns The same node, possibly with updated content and a `setText` mutation.
   */
  updateText(text: string, node: GpuiText): GpuiText {
    if (node.destroyed || node.content === text) return node;
    node.content = text;
    this.host.mutate('setText', node.id, text);
    return node;
  }

  /** Whether `child` is a GPUI node created by this renderer. */
  isNode(child: unknown): child is GpuiNode {
    return child instanceof GpuiNode;
  }

  /** Whether `child` is a logical group. */
  isGroup(child: unknown): child is GpuiGroup {
    return child instanceof GpuiGroup;
  }

  /**
   * Applies a JSX prop to a node. Handles `ref`, reactive `Cell` values,
   * style bindings, event listeners, and custom props.
   *
   * @param node - Target node.
   * @param key - Prop name (e.g. `"style"`, `"onClick"`, `"ref"`).
   * @param value - Prop value or reactive cell.
   * @returns The same node for chaining.
   */
  setProperty<N extends GpuiNode>(node: N, key: string, value: unknown): N {
    if (IGNORED_PROPS.has(key)) return node;

    if (key === 'ref' && value instanceof SourceCell) {
      value.set(node);
      node.setCleanup('ref', () => {
        if (value.peek() === node) value.set(null);
      });
      return node;
    }

    if (Cell.isCell(value)) {
      this.#watchCell(value, node.lifecycle.signal, (nextValue) =>
        this.#applyProperty(node, key, nextValue)
      );
      return node;
    }

    this.#applyProperty(node, key, value);
    return node;
  }

  /** Flattens a group into its constituent logical nodes. */
  unwrapGroup(group: GpuiGroup): GpuiNode[] {
    return [...flattenGroups(group.children)];
  }

  /**
   * Appends logical children to a parent and syncs native children.
   *
   * @param parent - Parent element or group.
   * @param child - Child node(s) to append.
   * @returns The parent for chaining.
   */
  append(
    parent: GpuiElement | GpuiGroup,
    child: GpuiNode | GpuiNode[]
  ): GpuiNode {
    this.#applyStructureMutation(appendNodes(parent, child));
    return parent;
  }

  /** Creates a stable range handle inside a group for incremental updates. */
  createGroupHandle(group: GpuiGroup): GpuiRange {
    return createRange(group);
  }

  /** Returns the nodes currently spanned by a range handle. */
  getHandleNodes(handle: GpuiRange): GpuiNode[] {
    return getRangeNodes(handle);
  }

  /**
   * Replaces the content spanned by a range handle.
   *
   * @param handle - Range created via `createGroupHandle`.
   * @param newContent - Nodes to place inside the range.
   */
  write(handle: GpuiRange, newContent: GpuiNode[]): void {
    this.#applyStructureMutation(writeRange(handle, newContent));
  }

  /**
   * Reconciles a range against a new list using the framework's keyed diff.
   *
   * @param handle - Range to reconcile.
   * @param options - Reconciler options including caches and key retrieval.
   */
  reconcile(handle: GpuiRange, options: ReconcilerOptions<GpuiNode>): void {
    for (const [key, cached] of options.cacheFromLastRun) {
      if (options.newCache.has(key)) continue;
      for (const node of cached.nodes) {
        options.onBeforeNodeRemove?.(node, cached.index.get());
      }
    }

    const nextNodes: GpuiNode[] = [];
    let index = 0;
    for (const item of options.newList) {
      const key = options.retrieveOrSetItemKey(item, index++);
      const cached = options.newCache.get(key);
      if (cached) nextNodes.push(...cached.nodes);
    }
    this.#applyStructureMutation(writeRange(handle, nextNodes));
  }

  /**
   * Executes a component function within the renderer's state context.
   * When `hmr` is enabled, wraps execution with {@link withHMRBoundaries}.
   *
   * @param tagNameOrFunction - Component function to invoke.
   * @param props - Arguments forwarded to the component (props array).
   * @param _snapshot - Optional state snapshot (from the framework).
   * @param fileData - Dev file metadata used for HMR scope tracking.
   */
  handleComponent(
    tagNameOrFunction: __HMR_UpdatableFn,
    props: any[],
    _snapshot?: StateSnapshot,
    fileData?: JSX.JSXDevFileData
  ): GpuiNode | GpuiNode[] {
    if (this.#hmr) {
      return withHMRBoundaries(tagNameOrFunction, props, fileData, this);
    }

    const nodes = createNodesFromTemplate(tagNameOrFunction(...props), this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * Whether a node is currently attached under the renderer's root.
   *
   * @param node - Node to test.
   */
  isActive(node: GpuiNode): boolean {
    return (
      !node.destroyed &&
      this.#root !== null &&
      hasAncestor(node, (ancestor) => ancestor === this.#root)
    );
  }

  /** Flushes pending GPUiX mutations synchronously. */
  flush(): void {
    this.host.flush();
  }

  /**
   * Replaces the root with a full-screen error overlay showing `error`.
   * Subsequent calls update the existing overlay text.
   *
   * @param error - Error to display; strings, Error stacks, or JSON are all accepted.
   */
  showDevelopmentError(error: unknown): void {
    const message =
      error instanceof Error
        ? (error.stack ?? error.message)
        : typeof error === 'string'
          ? error
          : (JSON.stringify(error, null, 2) ?? String(error));

    if (this.#devErrorText) {
      this.updateText(message, this.#devErrorText);
      this.flush();
      return;
    }

    const root = this.createContainer('div');
    const text = this.createText(message);
    this.setProperty(root, 'style', {
      width: '100%',
      height: '100%',
      padding: 24,
      backgroundColor: '#1a1111',
    });
    this.setProperty(text, 'style', {
      color: '#ff8a8a',
      whiteSpace: 'normal',
    });
    this.append(root, text);
    this.#devErrorRoot = root;
    this.#devErrorText = text;
    this.host.mutate('setRoot', root.id);
    this.flush();
  }

  /**
   * Removes the development error overlay and restores the original root.
   * No-ops if no overlay is showing.
   */
  clearDevelopmentError(): void {
    const root = this.#devErrorRoot;
    if (!root) return;

    this.#devErrorRoot = null;
    this.#devErrorText = null;
    if (this.#root) this.host.mutate('setRoot', this.#root.id);
    this.#destroyElement(root);
    this.flush();
  }

  /**
   * Disposes the renderer, stops the frame loop, and destroys all owned native nodes.
   * Throws if disposal would leak native nodes.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.host.stopFrameLoop();
    this.#clearTree();
    this.#disposed = true;
  }

  /**
   * Disposes the current Retend root while keeping the native window alive.
   * Used by development full reloads before mounting a fresh application root.
   */
  unmount(): void {
    if (this.#disposed) return;
    this.#clearTree();
  }

  #clearTree(): void {
    if (this.#destroyTimer !== null) clearTimeout(this.#destroyTimer);
    this.#destroyTimer = null;
    this.#state?.node.dispose();
    this.#state = undefined;

    this.host.flush();
    const nativeRoots = this.#collectOwnedNativeRoots();
    this.#root = null;
    this.#devErrorRoot = null;
    this.#devErrorText = null;
    for (const root of nativeRoots) this.#destroyElement(root);
    for (const node of this.#pendingDestroy) {
      if (!node.destroyed) node.markDestroyed();
    }
    this.#pendingDestroy.clear();
    this.host.flush();

    if (this.#nodesById.size !== 0) {
      throw new Error(
        `RetendGpuiRenderer teardown left ${this.#nodesById.size} native node(s) owned.`
      );
    }
  }

  #materializeRoot(result: GpuiNode): GpuiElement {
    if (result instanceof GpuiElement) return result;

    const root = this.createContainer('div');
    root.style = { width: '100%', height: '100%' };
    this.#applyStructureMutation(appendNodes(root, result));
    return root;
  }

  #applyStructureMutation(mutation: StructureMutation): void {
    const nativeParents = new Set<GpuiElement>();
    for (const parent of mutation.affectedParents) {
      const nativeParent = this.#nearestNativeParent(parent);
      if (nativeParent && !nativeParent.destroyed)
        nativeParents.add(nativeParent);
    }
    for (const parent of nativeParents) this.#syncNativeChildren(parent);

    if (mutation.detachedNodes.size > 0) {
      for (const node of mutation.detachedNodes) this.#pendingDestroy.add(node);
      this.#scheduleDestroy();
    }

    if (nativeParents.size > 0 || mutation.detachedNodes.size > 0) {
      this.host.requestFlush();
    }
  }

  #nearestNativeParent(node: GpuiParentNode): GpuiElement | null {
    if (node instanceof GpuiElement) return node;
    let current = node.parent;
    while (current) {
      if (current instanceof GpuiElement) return current;
      current = current.parent;
    }
    return null;
  }

  #syncNativeChildren(parent: GpuiElement): void {
    const desired = collectNativeChildren(parent);
    const desiredSet = new Set(desired);
    const working = parent.nativeChildren.filter((child) => !child.destroyed);

    for (let index = working.length - 1; index >= 0; index -= 1) {
      const child = working[index];
      if (desiredSet.has(child)) continue;
      this.host.mutate('removeChild', parent.id, child.id);
      working.splice(index, 1);
    }

    for (let index = 0; index < desired.length; index += 1) {
      const child = desired[index];
      if (working[index] === child) continue;

      const currentIndex = working.indexOf(child);
      if (currentIndex !== -1) working.splice(currentIndex, 1);

      const before = working[index];
      if (before)
        this.host.mutate('insertBefore', parent.id, child.id, before.id);
      else this.host.mutate('appendChild', parent.id, child.id);
      working.splice(index, 0, child);
    }

    parent.nativeChildren = desired;
    for (const child of desired) this.#publishStyle(child, false);
  }

  #scheduleDestroy(): void {
    if (this.#destroyTimer !== null) return;
    this.#destroyTimer = setTimeout(() => {
      this.#destroyTimer = null;
      const pending = [...this.#pendingDestroy];
      this.#pendingDestroy.clear();
      for (const node of pending) {
        if (node.destroyed || node.parent !== null || this.isActive(node))
          continue;
        this.#destroyDetached(node);
      }
    }, 0);
  }

  #destroyDetached(node: GpuiNode): void {
    if (node instanceof GpuiElement) {
      this.#destroyElement(node);
      return;
    }
    if (node instanceof GpuiParentNode) {
      for (const child of node.children.slice()) this.#destroyDetached(child);
      node.children.length = 0;
    }
    node.markDestroyed();
  }

  #destroyElement(node: GpuiElement): void {
    if (node.destroyed) return;
    const id = node.id;
    this.#markDestroyedSubtree(node);
    this.host.mutate('destroyElement', id);
  }

  #collectOwnedNativeRoots(): GpuiElement[] {
    const owned = new Set(this.#nodesById.values());
    return [...owned].filter(
      (node) =>
        !hasAncestor(
          node.parent,
          (ancestor) => ancestor instanceof GpuiElement && owned.has(ancestor)
        )
    );
  }

  #markDestroyedSubtree(node: GpuiNode): void {
    if (node instanceof GpuiParentNode) {
      const children = node.children.slice();
      node.children.length = 0;
      for (const child of children) this.#markDestroyedSubtree(child);
    }

    if (node instanceof GpuiElement) {
      node.eventHandlers.clear();
      node.nativeChildren = [];
      this.#nodesById.delete(node.id);
    }
    node.parent = null;
    node.markDestroyed();
  }

  #dispatchNativeEvent(event: EventPayload): void {
    const node = this.#nodesById.get(event.elementId);
    if (!node || !this.isActive(node)) return;
    node.eventHandlers.get(event.eventType)?.(event);
  }

  #applyProperty(node: GpuiNode, key: string, value: unknown): void {
    if (key === 'ref') {
      if (typeof value === 'function') {
        const callback = value as (target: GpuiNode | null) => void;
        callback(node);
        node.setCleanup('ref', () => callback(null));
      }
      return;
    }
    if (!(node instanceof GpuiElement) || node.destroyed) return;

    if (key === 'style') {
      this.#bindStyle(node, value);
      return;
    }

    const eventType = eventTypeForProp(key);
    if (eventType) {
      const hadHandler = node.eventHandlers.has(eventType);
      if (typeof value === 'function') {
        node.eventHandlers.set(
          eventType,
          value as (event: EventPayload) => void
        );
        if (!hadHandler)
          this.host.mutate('setEventListener', node.id, eventType, true);
      } else if (hadHandler) {
        node.eventHandlers.delete(eventType);
        this.host.mutate('setEventListener', node.id, eventType, false);
      }
      return;
    }

    if (
      (node.tagName === 'div' || node.tagName === 'text') &&
      !UNIVERSAL_PROPS.has(key)
    ) {
      return;
    }

    this.host.mutate(
      'setCustomPropValue',
      node.id,
      key,
      value === undefined || typeof value === 'function'
        ? null
        : (value as object | string | number | boolean | null)
    );
  }

  #bindStyle(node: GpuiElement, value: unknown): void {
    const controller = new AbortController();
    node.setCleanup('style', () => controller.abort());

    if (!value || typeof value !== 'object') {
      node.style = {};
      this.#publishStyle(node);
      return;
    }

    const resolved: Record<string, unknown> = {};
    node.style = resolved as GpuiStyle;
    const publish = () => {
      if (!controller.signal.aborted && !node.destroyed)
        this.#publishStyle(node);
    };

    for (const [property, propertyValue] of Object.entries(value)) {
      if (!Cell.isCell(propertyValue)) {
        resolved[property] = propertyValue;
        continue;
      }

      const update = (nextValue: unknown) => {
        resolved[property] = nextValue;
        publish();
      };
      const initialValue = this.#watchCell(
        propertyValue,
        controller.signal,
        update,
        false
      );
      if (initialValue instanceof Promise) void initialValue.then(update);
      else resolved[property] = initialValue;
    }

    publish();
  }

  #publishStyle(node: GpuiElement, cascade = true): void {
    const style: GpuiStyle =
      node.tagName === 'div' && node.style.display == null
        ? { ...NORMAL_FLOW_STYLE, ...node.style }
        : { ...node.style };

    const parent = node.parent ? this.#nearestNativeParent(node.parent) : null;
    if (
      node.tagName === 'div' &&
      style.width == null &&
      parent?.tagName === 'div' &&
      parent.style.display == null
    ) {
      style.width = '100%';
    }

    if (node === this.#root) {
      if (style.backgroundColor == null)
        style.backgroundColor = ROOT_STYLE.backgroundColor;
      if (style.color == null) style.color = ROOT_STYLE.color;
    }

    this.host.mutate('setStyle', node.id, style);
    if (cascade && node.tagName === 'div') {
      for (const child of collectNativeChildren(node)) {
        this.#publishStyle(child, false);
      }
    }
  }

  #watchCell(
    cell: Cell<unknown>,
    signal: AbortSignal,
    update: (value: unknown) => void,
    emitInitial = true
  ): unknown {
    if (cell instanceof AsyncCell) useAwait()?.waitUntil(cell);
    const resolve = (value: unknown) => {
      if (signal.aborted) return;
      if (value instanceof Promise) void value.then(resolve);
      else update(value);
    };
    const initialValue = cell.get();
    if (emitInitial) resolve(initialValue);
    cell.listen(resolve, { signal });
    return initialValue;
  }
}

/**
 * Convenience helper that creates, initializes, and renders a GPUI application.
 * Sets the active renderer, runs pending setup effects, flushes mutations,
 * and starts the host frame loop.
 *
 * @param App - Root component function returning a JSX template.
 * @param options - Optional native window options forwarded to `RetendGpuiRenderer.init`.
 * @returns The initialized renderer instance that owns the rendered tree.
 *
 * @example
 * ```tsx
 * import { renderToGpui } from "retend-gpui";
 * const renderer = await renderToGpui(() => <div>Hello</div>, { title: "Demo", width: 800, height: 600 });
 * ```
 */
export async function renderToGpui(
  App: () => JSX.Template,
  options?: WindowOptions
): Promise<RetendGpuiRenderer> {
  const renderer = new RetendGpuiRenderer();
  renderer.init(options);
  setActiveRenderer(renderer);
  renderer.render(App);
  await runPendingSetupEffects();
  renderer.flush();
  renderer.host.startFrameLoop();
  return renderer;
}

export { GpuiAnchor, GpuiElement, GpuiGroup, GpuiNode, GpuiText };
export type { GpuiRange };

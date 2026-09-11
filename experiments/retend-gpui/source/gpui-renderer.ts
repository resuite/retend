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

import type { NativeEventPayload } from './native/addon.js';
import type {
  ElementKind as ElementKindValue,
  PropertyId as PropertyIdValue,
} from './native/protocol.generated.js';
import type { ProtocolPropertyValue } from './native/protocol.js';
import type { GpuiElementType, GpuiStyle } from './types.js';
import type { GpuiWindowOptions } from './window.js';

import {
  createNativeEvent,
  parseEventProperty,
  type NativeTransportEventId,
  type ParsedEventProperty,
} from './events.js';
import { GpuiHost } from './gpui-host.js';
import { ElementKind, PropertyId } from './native/protocol.generated.js';
import { withHMRBoundaries } from './plugins/hmr.js';
import {
  collectNativeChildren,
  flattenGroups,
  GpuiAnchor,
  GpuiDivElement,
  GpuiElement,
  GpuiGroup,
  GpuiImageElement,
  GpuiInputElement,
  GpuiTextareaElement,
  GpuiNode,
  GpuiRoot,
  GpuiText,
  GpuiParentNode,
  type GpuiNativeNode,
  type GpuiRange,
} from './tree/nodes.js';
import {
  appendNodes,
  createRange,
  getRangeNodes,
  writeRange,
} from './tree/operations.js';
const STYLE_PROPERTY_RANGE = [PropertyId.Display, PropertyId.Overflow] as const;
const IMAGE_PROPERTY_RANGE = [PropertyId.Src, PropertyId.ObjectFit] as const;

function propertyIdInRange(
  property: string,
  [minimum, maximum]: readonly [PropertyIdValue, PropertyIdValue]
): PropertyIdValue | undefined {
  const name = property[0]?.toUpperCase() + property.slice(1);
  const id = (PropertyId as Record<string, PropertyIdValue | undefined>)[name];
  return id !== undefined && id >= minimum && id <= maximum ? id : undefined;
}

const ELEMENT_KIND_BY_TAG = {
  div: ElementKind.Container,
  img: ElementKind.Image,
  input: ElementKind.Input,
  textarea: ElementKind.Textarea,
} satisfies Record<GpuiElementType, ElementKindValue>;

const ELEMENT_FACTORIES = {
  div: GpuiDivElement,
  img: GpuiImageElement,
  input: GpuiInputElement,
  textarea: GpuiTextareaElement,
} as const;

function protocolPropertyValue(value: unknown): ProtocolPropertyValue {
  if (value == null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  throw new TypeError(
    'Native GPUI properties must resolve to primitive values.'
  );
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
  /** Creates the native retained tree without opening an OS window. */
  headless?: boolean;
}

interface DevelopmentError {
  root: GpuiElement;
  text: GpuiText;
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
 * Retend renderer backed by the Retend-owned GPUI retained tree.
 * Implements the `Renderer` interface from `retend` and translates JSX operations
 * into batched binary commands forwarded through {@link GpuiHost}.
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
  /** Window-local host backed by the Retend-owned native command bridge. */
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

  #state?: StateSnapshot;
  #root: GpuiRoot | null = null;
  #mountedNativeRoots = new Set<GpuiNativeNode>();
  #nodesById = new Map<number, GpuiNativeNode>();
  #pendingDestroy = new Set<GpuiNode>();
  #destroyTimer: ReturnType<typeof setTimeout> | null = null;
  #devError: DevelopmentError | null = null;
  #disposed = false;
  readonly #hmr: boolean;

  /** Creates a renderer. */
  constructor(options: RetendGpuiRendererOptions = {}) {
    this.#hmr = options.hmr ?? false;
    this.host = new GpuiHost({
      headless: options.headless,
      onNativeEvent: (event) => this.#dispatchNativeEvent(event),
    });
    this.host.addEventListener('fatal', () => this.#discardTree());
  }

  /** @internal Synchronizes a logical node move with the native tree. */
  moveNode(
    node: GpuiNode,
    previous: GpuiParentNode | null,
    parent: GpuiParentNode | null,
    position: number
  ): void {
    if (!(node instanceof GpuiElement || node instanceof GpuiText)) return;
    const previousId = previous && this.#nativeParentId(previous);
    const parentId = parent && this.#nativeParentId(parent);
    if (parent && parentId != null) {
      let before: GpuiNativeNode | undefined;
      for (let index = position + 1; index < parent.children.length; index++) {
        const child = parent.children[index];
        if (child instanceof GpuiElement || child instanceof GpuiText) {
          before = child;
          break;
        }
      }
      // With no following sibling, insert before the development overlay so it
      // stays the last native root and keeps painting above application content.
      if (!before && parent === this.#root && this.#devError) {
        before = this.#devError.root;
      }
      this.host.insertChild(parentId, node.id, before?.id ?? 0);
    } else if (previousId != null) {
      this.host.removeChild(previousId, node.id);
    }
    if (previous === this.#root && previousId != null)
      this.#mountedNativeRoots.delete(node);
    if (parent === this.#root && parentId != null)
      this.#mountedNativeRoots.add(node);
  }

  /** @internal Schedules settlement after a node leaves a logical range. */
  releaseNode(node: GpuiNode): void {
    this.#pendingDestroy.add(node);
    this.#scheduleDestroy();
  }

  /** @internal Reports a node listener failure to the application. */
  reportListenerError(error: unknown): void {
    console.error('[retend-gpui] event listener failed:', error);
    this.host.reportApplicationError(error);
  }

  /**
   * Initializes the underlying host and native renderer.
   *
   * @param options - Native window options forwarded to `GpuiHost.init`.
   */
  init(options?: GpuiWindowOptions): void {
    if (this.#disposed) {
      throw new Error(
        'A disposed RetendGpuiRenderer cannot be initialized again.'
      );
    }
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
    try {
      return withState(this.#state, () => {
        const result = normalizeJsxChild(app, this);
        const root = new GpuiRoot(this.host, this);
        this.#root = root;
        appendNodes(root, result);
        this.host.flush();
        return result;
      });
    } catch (error) {
      this.#discardTree();
      this.host.discardPendingCommands();
      throw error;
    }
  }

  /** Mounts a root, runs pending setup effects, and submits the final mutations. */
  async mount(app: JSX.Template): Promise<GpuiNode | GpuiNode[]> {
    setActiveRenderer(this);
    const result = this.render(app);
    await runPendingSetupEffects();
    // `runPendingSetupEffects()` activates the process-wide root. Once a first
    // window has done that, the root is already active, so a later window's
    // branch is never reached. Activate this renderer's own branch directly so
    // its setup effects run.
    await this.#state?.node.activate();
    this.flush();
    return result;
  }

  /** Creates a logical group node with no native counterpart. */
  createGroup(): GpuiGroup {
    return new GpuiGroup(this.host, this);
  }

  /**
   * Creates the concrete native element class for an intrinsic tag.
   *
   * @param tagName - One of the Retend GPUI v1 intrinsic tags.
   * @throws If the tag is not part of the Retend GPUI intrinsic surface.
   */
  createContainer(tagName: 'div'): GpuiDivElement;
  createContainer(tagName: 'img'): GpuiImageElement;
  createContainer(tagName: 'input'): GpuiInputElement;
  createContainer(tagName: 'textarea'): GpuiTextareaElement;
  createContainer(tagName: string): GpuiElement;
  createContainer(tagName: string): GpuiElement {
    const Factory = ELEMENT_FACTORIES[tagName as GpuiElementType];
    if (!Factory) {
      throw new Error(
        `Unsupported Retend GPUI intrinsic element: <${tagName}>. ` +
          'Supported tags are <div>, <img>, <input>, and <textarea>; text is ordinary JSX content.'
      );
    }

    const tag = tagName as GpuiElementType;
    const id = this.host.createNode(ELEMENT_KIND_BY_TAG[tag]);
    const node = new Factory(id, this.host, this);
    this.#nodesById.set(node.id, node);
    return node;
  }

  /**
   * Creates a native text node.
   *
   * @param text - Initial text content.
   */
  createText(text: string): GpuiText {
    const node = new GpuiText(
      this.host.createText(text),
      text,
      this.host,
      this
    );
    this.#nodesById.set(node.id, node);
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
    this.host.updateText(node.id, text);
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
   * @param key - Prop name (e.g. `"style"`, `"src"`, `"ref"`).
   * @param value - Prop value or reactive cell.
   * @returns The same node for chaining.
   */
  setProperty<N extends GpuiNode>(node: N, key: string, value: unknown): N {
    if (
      key === 'children' ||
      key === 'className' ||
      key === 'key' ||
      key === 'retend:collection'
    )
      return node;

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
    if (parent instanceof GpuiElement && !parent.acceptsChildren) {
      throw new Error(`<${parent.tagName}> cannot contain GPUI children.`);
    }
    appendNodes(parent, child);
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
    writeRange(handle, newContent);
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
    writeRange(handle, nextNodes);
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

  /** Flushes pending Retend-owned native mutations synchronously. */
  flush(): void {
    this.host.flush();
  }

  /**
   * Adds a full-screen error overlay above the application root showing `error`.
   * The application subtree stays mounted underneath. Subsequent calls update
   * the existing overlay text.
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

    if (this.#devError) {
      this.updateText(message, this.#devError.text);
      this.flush();
      return;
    }

    const root = this.createContainer('div');
    const text = this.createText(message);
    this.setProperty(root, 'style', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      padding: 24,
      backgroundColor: '#1a1111',
      color: '#ff8a8a',
      whiteSpace: 'normal',
    });
    this.append(root, text);
    this.#devError = { root, text };
    try {
      this.#syncWindowRoot();
      this.flush();
    } catch (error) {
      this.#devError = null;
      this.#markDestroyedSubtree(root);
      this.host.discardPendingCommands();
      throw error;
    }
  }

  /**
   * Removes the development error overlay and restores the original root.
   * No-ops if no overlay is showing.
   */
  clearDevelopmentError(): void {
    const root = this.#devError?.root;
    if (!root) return;

    this.#devError = null;
    this.#syncWindowRoot();
    this.#markDestroyedSubtree(root);
    this.host.settle();
  }

  /** Disposes the renderer and closes its native window. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#discardTree();
    this.host.close();
  }

  /**
   * Disposes the current Retend root while keeping the native window alive.
   * Used by development full reloads before mounting a fresh application root.
   */
  unmount(): void {
    if (this.#disposed || (!this.#state && this.#nodesById.size === 0)) return;
    const mountedRoots = new Set(this.#mountedNativeRoots);
    const roots = this.#takeOwnedRoots();
    for (const root of roots) {
      if (!mountedRoots.has(root)) {
        // Cycling an unattached root through the immutable window root makes it
        // settlement-eligible without adding a separate destroy opcode.
        this.host.insertChild(this.host.rootId, root.id);
      }
      this.host.removeChild(this.host.rootId, root.id);
    }
    this.#destroyOwnedNodes(roots);
    this.host.settle();
    if (this.#nodesById.size !== 0) {
      throw new Error(
        `RetendGpuiRenderer teardown left ${this.#nodesById.size} native node(s) owned.`
      );
    }
  }

  #discardTree(): void {
    this.#destroyOwnedNodes(this.#takeOwnedRoots());
  }

  #takeOwnedRoots(): GpuiNativeNode[] {
    if (this.#destroyTimer !== null) clearTimeout(this.#destroyTimer);
    this.#destroyTimer = null;
    this.#state?.node.dispose();
    this.#state = undefined;
    const roots = [...this.#nodesById.values()].filter(
      (node) =>
        !hasAncestor(
          node.parent,
          (ancestor) =>
            ancestor instanceof GpuiElement &&
            this.#nodesById.get(ancestor.id) === ancestor
        )
    );
    this.#mountedNativeRoots.clear();
    this.#root = null;
    this.#devError = null;
    return roots;
  }

  #destroyOwnedNodes(roots: readonly GpuiNativeNode[]): void {
    for (const root of roots) this.#markDestroyedSubtree(root);
    for (const node of this.#pendingDestroy) {
      if (!node.destroyed) node.markDestroyed();
    }
    this.#pendingDestroy.clear();
  }

  #syncWindowRoot(): void {
    const roots = this.#root ? collectNativeChildren(this.#root) : [];
    if (this.#devError) roots.push(this.#devError.root);
    this.#mountNativeRoots(roots);
  }

  #mountNativeRoots(desired: readonly GpuiNativeNode[]): void {
    const retained = new Set(desired);
    for (const node of this.#mountedNativeRoots) {
      if (!node.destroyed && !retained.has(node))
        this.host.removeChild(this.host.rootId, node.id);
    }
    for (const node of desired) {
      if (!this.#mountedNativeRoots.has(node))
        this.host.insertChild(this.host.rootId, node.id);
    }
    this.#mountedNativeRoots = retained;
  }

  #nativeParentId(parent: GpuiParentNode): number | undefined {
    if (parent instanceof GpuiElement && !parent.destroyed) return parent.id;
    if (parent === this.#root) return this.host.rootId;
    return undefined;
  }

  #scheduleDestroy(): void {
    if (this.#destroyTimer !== null) return;
    // Retend moves and retained-handle restoration can continue through
    // microtasks after lifecycle activation. Defer permanent destruction to
    // the next turn so all same-update reinsertions can complete first.
    this.#destroyTimer = setTimeout(() => {
      this.#destroyTimer = null;
      const pending = [...this.#pendingDestroy];
      this.#pendingDestroy.clear();
      let settle = false;
      for (const node of pending) {
        if (node.destroyed || node.parent !== null) continue;
        this.#markDestroyedSubtree(node);
        settle = true;
      }
      if (settle) this.host.settle();
    }, 0);
  }

  #markDestroyedSubtree(node: GpuiNode): void {
    if (node instanceof GpuiParentNode) {
      for (const child of node.children.splice(0))
        this.#markDestroyedSubtree(child);
    }

    if (node instanceof GpuiElement || node instanceof GpuiText) {
      this.#nodesById.delete(node.id);
    }
    node.parent = null;
    node.markDestroyed();
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
    const eventProperty = parseEventProperty(key);
    if (eventProperty) {
      this.#bindEventProperty(node, key, eventProperty, value);
      return;
    }

    if (!(node instanceof GpuiElement) || node.destroyed) {
      return;
    }

    if (key === 'style') {
      this.#bindStyle(node, value);
      return;
    }

    let property: PropertyIdValue | undefined;
    if (key === 'tabIndex') property = PropertyId.TabIndex;
    else if (node.tagName === 'img')
      property = propertyIdInRange(key, IMAGE_PROPERTY_RANGE);
    else if (
      (node.tagName === 'input' || node.tagName === 'textarea') &&
      key === 'value'
    )
      property = PropertyId.Value;
    else if (node.tagName === 'textarea' && key === 'minRows')
      property = PropertyId.MinRows;
    else if (node.tagName === 'textarea' && key === 'maxRows')
      property = PropertyId.MaxRows;
    if (property !== undefined) {
      this.host.setProperty(node.id, property, protocolPropertyValue(value));
    }
  }

  #bindEventProperty(
    node: GpuiNode,
    key: string,
    property: ParsedEventProperty,
    value: unknown
  ): void {
    const cleanupKey = `event:${key}`;
    if (
      typeof value !== 'function' &&
      !(value && typeof value === 'object' && 'handleEvent' in value)
    ) {
      node.setCleanup(cleanupKey, () => {});
      return;
    }

    const callback = value as EventListenerOrEventListenerObject;
    const options: AddEventListenerOptions = {};
    const actions: string[] = [];
    for (const modifier of property.modifiers) {
      if (modifier === 'once' || modifier === 'passive')
        options[modifier] = true;
      else if (
        modifier === 'self' ||
        modifier === 'prevent' ||
        modifier === 'stop'
      )
        actions.unshift(modifier);
      else console.warn(`Unknown event listener modifier: ${modifier}`);
    }
    const listener: EventListener = (event) => {
      for (const action of actions) {
        if (action === 'self' && event.target !== event.currentTarget) return;
        if (action === 'prevent') event.preventDefault();
        if (action === 'stop') event.stopPropagation();
      }
      if (typeof callback === 'function') callback.call(node, event);
      else callback.handleEvent(event);
    };
    node.addEventListener(property.type, listener, options);
    node.setCleanup(cleanupKey, () =>
      node.removeEventListener(property.type, listener)
    );
  }

  /** @internal Synchronizes native subscriptions for node listeners. */
  nativeSubscriptionChanged(
    node: GpuiNode,
    eventId: NativeTransportEventId,
    enabled: boolean
  ): void {
    // Native event subscriptions are element-only: text renders as a plain
    // GPUI Text with no hit-testing, so subscriptions could never deliver.
    if (
      !(node instanceof GpuiElement) ||
      node.destroyed ||
      this.#disposed ||
      !this.host.isInitialized
    ) {
      return;
    }

    const active = this.isActive(node);
    // Keep pending mutations and the subscription in the same ordered batch.
    if (enabled) this.host.subscribeEvent(node.id, eventId);
    else this.host.unsubscribeEvent(node.id, eventId);
    if (active) this.host.flush();
  }

  #dispatchNativeEvent(payload: NativeEventPayload): void {
    const target = this.#nodesById.get(payload.targetId);
    if (
      !target ||
      !this.isActive(target) ||
      !this.host.isNodePresented(target.id)
    )
      return;
    target.dispatchEvent(createNativeEvent(payload));
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
    let initializing = true;

    for (const [property, propertyValue] of Object.entries(value)) {
      if (!Cell.isCell(propertyValue)) {
        resolved[property] = propertyValue;
        continue;
      }

      this.#watchCell(propertyValue, controller.signal, (nextValue) => {
        resolved[property] = nextValue;
        if (!initializing && !node.destroyed) this.#publishStyle(node);
      });
    }

    initializing = false;
    if (!controller.signal.aborted && !node.destroyed) this.#publishStyle(node);
  }

  #publishStyle(node: GpuiElement): void {
    const properties: [PropertyIdValue, ProtocolPropertyValue][] = [];
    for (const [property, value] of Object.entries(node.style)) {
      if (value === undefined) continue;
      const id = propertyIdInRange(property, STYLE_PROPERTY_RANGE);
      if (id === undefined) {
        throw new Error(`Unsupported Retend GPUI style property: ${property}.`);
      }
      properties.push([id, protocolPropertyValue(value)]);
    }
    this.host.setStyle(node.id, properties);
  }

  #watchCell(
    cell: Cell<unknown>,
    signal: AbortSignal,
    update: (value: unknown) => void
  ): void {
    if (cell instanceof AsyncCell) useAwait()?.waitUntil(cell);
    const resolve = (value: unknown) => {
      if (signal.aborted) return;
      if (value instanceof Promise) void value.then(resolve);
      else update(value);
    };
    resolve(cell.get());
    cell.listen(resolve, { signal });
  }
}

/**
 * Convenience helper that creates, initializes, and renders a GPUI application.
 * Sets the active renderer, runs pending setup effects, and flushes mutations.
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
  options?: GpuiWindowOptions
): Promise<RetendGpuiRenderer> {
  const renderer = new RetendGpuiRenderer();
  renderer.init(options);
  await renderer.mount(App);
  return renderer;
}

export {
  GpuiAnchor,
  GpuiDivElement,
  GpuiElement,
  GpuiGroup,
  GpuiImageElement,
  GpuiInputElement,
  GpuiTextareaElement,
  GpuiNode,
  GpuiText,
};
export type { GpuiRange };

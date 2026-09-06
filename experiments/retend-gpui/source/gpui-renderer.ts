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
import { ElementKind, PropertyId } from './native/protocol.js';
import { withHMRBoundaries } from './plugins/hmr.js';
import {
  GpuiAnchor,
  GpuiElement,
  GpuiGroup,
  GpuiNode,
  GpuiRoot,
  GpuiText,
  GpuiParentNode,
  type GpuiNodeEventOwner,
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
import { GPUI_ELEMENT_TYPES } from './types.js';
const IGNORED_PROPS = new Set([
  'children',
  'className',
  'key',
  'retend:collection',
]);
const STYLE_PROPERTY_IDS = {
  display: PropertyId.Display,
  flexDirection: PropertyId.FlexDirection,
  flexWrap: PropertyId.FlexWrap,
  flexGrow: PropertyId.FlexGrow,
  flexShrink: PropertyId.FlexShrink,
  alignItems: PropertyId.AlignItems,
  alignSelf: PropertyId.AlignSelf,
  alignContent: PropertyId.AlignContent,
  justifyContent: PropertyId.JustifyContent,
  gap: PropertyId.Gap,
  rowGap: PropertyId.RowGap,
  columnGap: PropertyId.ColumnGap,
  width: PropertyId.Width,
  height: PropertyId.Height,
  minWidth: PropertyId.MinWidth,
  minHeight: PropertyId.MinHeight,
  maxWidth: PropertyId.MaxWidth,
  maxHeight: PropertyId.MaxHeight,
  padding: PropertyId.Padding,
  paddingTop: PropertyId.PaddingTop,
  paddingRight: PropertyId.PaddingRight,
  paddingBottom: PropertyId.PaddingBottom,
  paddingLeft: PropertyId.PaddingLeft,
  margin: PropertyId.Margin,
  marginTop: PropertyId.MarginTop,
  marginRight: PropertyId.MarginRight,
  marginBottom: PropertyId.MarginBottom,
  marginLeft: PropertyId.MarginLeft,
  position: PropertyId.Position,
  top: PropertyId.Top,
  right: PropertyId.Right,
  bottom: PropertyId.Bottom,
  left: PropertyId.Left,
  backgroundColor: PropertyId.BackgroundColor,
  color: PropertyId.Color,
  opacity: PropertyId.Opacity,
  borderWidth: PropertyId.BorderWidth,
  borderColor: PropertyId.BorderColor,
  borderRadius: PropertyId.BorderRadius,
  fontSize: PropertyId.FontSize,
  fontFamily: PropertyId.FontFamily,
  fontWeight: PropertyId.FontWeight,
  textAlign: PropertyId.TextAlign,
  lineHeight: PropertyId.LineHeight,
  whiteSpace: PropertyId.WhiteSpace,
} satisfies Record<keyof GpuiStyle, PropertyIdValue>;

const ELEMENT_KIND_BY_TAG = {
  div: ElementKind.Container,
  img: ElementKind.Image,
} satisfies Record<GpuiElementType, ElementKindValue>;

const IMAGE_PROPERTY_IDS = {
  src: PropertyId.Src,
  objectFit: PropertyId.ObjectFit,
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
  #mountedNativeRoots: GpuiElement[] = [];
  #nodesById = new Map<number, GpuiElement>();
  #pendingDestroy = new Set<GpuiNode>();
  #destroyTimer: ReturnType<typeof setTimeout> | null = null;
  #devErrorRoot: GpuiElement | null = null;
  #devErrorText: GpuiText | null = null;
  #disposed = false;
  readonly #hmr: boolean;
  readonly #nodeEventOwner: GpuiNodeEventOwner = {
    nativeSubscriptionChanged: (node, eventId, enabled) =>
      this.#syncNativeSubscription(node, eventId, enabled),
    reportListenerError: (error) => {
      console.error('[retend-gpui] event listener failed:', error);
      this.host.reportApplicationError(error);
    },
  };

  /** Creates a renderer. */
  constructor(options: RetendGpuiRendererOptions = {}) {
    this.#hmr = options.hmr ?? false;
    this.host = new GpuiHost({
      headless: options.headless,
      onNativeEvent: (event) => this.#dispatchNativeEvent(event),
    });
    this.host.addEventListener('fatal', () => this.#discardLogicalTree());
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
        const root = new GpuiRoot(this.#nodeEventOwner);
        this.#root = root;
        this.#applyStructureMutation(appendNodes(root, result));
        this.host.flush();
        return result;
      });
    } catch (error) {
      this.#discardLogicalTree();
      this.host.discardPendingCommands();
      throw error;
    }
  }

  /** Creates a logical group node with no native counterpart. */
  createGroup(): GpuiGroup {
    return new GpuiGroup(this.#nodeEventOwner);
  }

  /**
   * Creates a native element for an intrinsic tag.
   *
   * @param tagName - One of the Retend GPUI v1 intrinsic tags.
   * @returns The created `GpuiElement` and enqueues a native creation mutation.
   * @throws If the tag is not part of the Retend GPUI intrinsic surface.
   */
  createContainer(tagName: string): GpuiElement {
    if (!GPUI_ELEMENT_TYPES.includes(tagName as GpuiElementType)) {
      throw new Error(
        `Unsupported Retend GPUI intrinsic element: <${tagName}>. ` +
          'Supported tags are <div> and <img>; text is ordinary JSX content.'
      );
    }

    const tag = tagName as GpuiElementType;
    const node = new GpuiElement(
      this.host.createNode(ELEMENT_KIND_BY_TAG[tag]),
      tag,
      tag === 'div',
      this.#nodeEventOwner
    );
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
      this.#nodeEventOwner
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
    if (parent instanceof GpuiElement && !parent.acceptsChildren) {
      throw new Error(`<${parent.tagName}> cannot contain GPUI children.`);
    }
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

  /** Flushes pending Retend-owned native mutations synchronously. */
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
      color: '#ff8a8a',
      whiteSpace: 'normal',
    });
    this.append(root, text);
    this.#devErrorRoot = root;
    this.#devErrorText = text;
    this.#mountNativeRoots([root]);
    try {
      this.flush();
    } catch (error) {
      this.#devErrorRoot = null;
      this.#devErrorText = null;
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
    const root = this.#devErrorRoot;
    if (!root) return;

    this.#devErrorRoot = null;
    this.#devErrorText = null;
    this.#syncWindowRoot();
    this.#markDestroyedSubtree(root);
    this.host.settle();
  }

  /** Disposes the renderer and closes its native window. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#discardLogicalTree();
    this.host.close();
  }

  /**
   * Disposes the current Retend root while keeping the native window alive.
   * Used by development full reloads before mounting a fresh application root.
   */
  unmount(): void {
    if (this.#disposed || (!this.#state && this.#nodesById.size === 0)) return;
    this.#clearTree();
  }

  #discardLogicalTree(): void {
    if (this.#destroyTimer !== null) clearTimeout(this.#destroyTimer);
    this.#destroyTimer = null;
    const roots = this.#collectOwnedNativeRoots();
    for (const root of roots) this.#markDestroyedSubtree(root);
    for (const node of this.#pendingDestroy) {
      if (!node.destroyed) node.markDestroyed();
    }
    this.#pendingDestroy.clear();
    this.#mountedNativeRoots = [];
    this.#root = null;
    this.#devErrorRoot = null;
    this.#devErrorText = null;
    this.#state?.node.dispose();
    this.#state = undefined;
  }

  #clearTree(): void {
    if (this.#destroyTimer !== null) clearTimeout(this.#destroyTimer);
    this.#destroyTimer = null;
    this.#state?.node.dispose();
    this.#state = undefined;

    const nativeRoots = this.#collectOwnedNativeRoots();
    const mountedRoots = new Set(this.#mountedNativeRoots);
    for (const root of nativeRoots) {
      if (mountedRoots.has(root)) {
        this.host.removeChild(this.host.rootId, root.id);
      } else {
        // Cycling an unattached root through the immutable window root makes it
        // settlement-eligible without adding a separate destroy opcode.
        this.host.insertChild(this.host.rootId, root.id);
        this.host.removeChild(this.host.rootId, root.id);
      }
    }
    this.#mountedNativeRoots = [];
    this.#root = null;
    this.#devErrorRoot = null;
    this.#devErrorText = null;
    for (const root of nativeRoots) this.#markDestroyedSubtree(root);
    for (const node of this.#pendingDestroy) {
      if (!node.destroyed) node.markDestroyed();
    }
    this.#pendingDestroy.clear();
    this.host.settle();

    if (this.#nodesById.size !== 0) {
      throw new Error(
        `RetendGpuiRenderer teardown left ${this.#nodesById.size} native node(s) owned.`
      );
    }
  }

  #syncWindowRoot(): void {
    if (this.#devErrorRoot) return;
    this.#mountNativeRoots(this.#root ? collectNativeChildren(this.#root) : []);
  }

  #mountNativeRoots(desired: readonly GpuiElement[]): void {
    const working = this.#mountedNativeRoots.filter((node) => !node.destroyed);
    this.#syncNativeSequence(this.host.rootId, working, desired);
    this.#mountedNativeRoots = [...desired];
  }

  #applyStructureMutation(mutation: StructureMutation): void {
    const nativeParents = new Set<GpuiElement>();
    let windowRootAffected = false;
    for (const parent of mutation.affectedParents) {
      if (parent === this.#root) {
        windowRootAffected = true;
        continue;
      }
      const nativeParent = this.#nearestNativeParent(parent);
      if (nativeParent && !nativeParent.destroyed)
        nativeParents.add(nativeParent);
    }
    if (windowRootAffected) this.#syncWindowRoot();
    for (const parent of nativeParents) this.#syncNativeChildren(parent);

    if (mutation.detachedNodes.size > 0) {
      for (const node of mutation.detachedNodes) this.#pendingDestroy.add(node);
      this.#scheduleDestroy();
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
    const working = parent.nativeChildren.filter((child) => !child.destroyed);
    this.#syncNativeSequence(parent.id, working, desired);
    parent.nativeChildren = desired;
  }

  #syncNativeSequence(
    parentId: number,
    working: GpuiElement[],
    desired: readonly GpuiElement[]
  ): void {
    const desiredSet = new Set(desired);
    for (let index = working.length - 1; index >= 0; index -= 1) {
      const child = working[index];
      if (desiredSet.has(child)) continue;
      this.host.removeChild(parentId, child.id);
      working.splice(index, 1);
    }

    for (let index = 0; index < desired.length; index += 1) {
      const child = desired[index];
      if (working[index] === child) continue;

      const currentIndex = working.indexOf(child);
      if (currentIndex !== -1) working.splice(currentIndex, 1);

      const before = working[index];
      this.host.insertChild(parentId, child.id, before?.id ?? 0);
      working.splice(index, 0, child);
    }
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
        this.#destroyDetached(node);
        settle = true;
      }
      if (settle) this.host.settle();
    }, 0);
  }

  #destroyDetached(node: GpuiNode): void {
    if (node instanceof GpuiElement) {
      this.#markDestroyedSubtree(node);
      return;
    }
    if (node instanceof GpuiParentNode) {
      for (const child of node.children.slice()) this.#destroyDetached(child);
      node.children.length = 0;
    }
    node.markDestroyed();
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
      node.nativeChildren = [];
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

    if (
      !(node instanceof GpuiElement) ||
      node instanceof GpuiText ||
      node.destroyed
    ) {
      return;
    }

    if (key === 'style') {
      this.#bindStyle(node, value);
      return;
    }

    if (node.tagName === 'img' && Object.hasOwn(IMAGE_PROPERTY_IDS, key)) {
      this.host.setProperty(
        node.id,
        IMAGE_PROPERTY_IDS[key as keyof typeof IMAGE_PROPERTY_IDS],
        protocolPropertyValue(value)
      );
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
    let listener: EventListener = (event) => {
      if (typeof callback === 'function') callback.call(node, event);
      else callback.handleEvent(event);
    };
    const options: AddEventListenerOptions = {};
    for (const modifier of property.modifiers) {
      const previous = listener;
      if (modifier === 'self') {
        listener = (event) => {
          if (event.target !== event.currentTarget) return;
          previous(event);
        };
      } else if (modifier === 'prevent') {
        listener = (event) => {
          event.preventDefault();
          previous(event);
        };
      } else if (modifier === 'stop') {
        listener = (event) => {
          event.stopPropagation();
          previous(event);
        };
      } else if (modifier === 'once') {
        options.once = true;
      } else if (modifier === 'passive') {
        options.passive = true;
      } else {
        console.warn(`Unknown event listener modifier: ${modifier}`);
      }
    }
    node.addEventListener(property.type, listener, options);
    node.setCleanup(cleanupKey, () =>
      node.removeEventListener(property.type, listener)
    );
  }

  #syncNativeSubscription(
    node: GpuiNode,
    eventId: NativeTransportEventId,
    enabled: boolean
  ): void {
    if (
      !(node instanceof GpuiElement) ||
      node.destroyed ||
      this.#disposed ||
      !this.host.isInitialized
    ) {
      return;
    }

    const active = this.isActive(node);
    if (active) this.host.flush();
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

  #publishStyle(node: GpuiElement): void {
    const properties: [PropertyIdValue, ProtocolPropertyValue][] = [];
    for (const [property, value] of Object.entries(node.style)) {
      if (value === undefined) continue;
      const id = (
        STYLE_PROPERTY_IDS as Record<string, PropertyIdValue | undefined>
      )[property];
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
  setActiveRenderer(renderer);
  renderer.render(App);
  await runPendingSetupEffects();
  renderer.flush();
  return renderer;
}

export { GpuiAnchor, GpuiElement, GpuiGroup, GpuiNode, GpuiText };
export type { GpuiRange };

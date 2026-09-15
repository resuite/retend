import type { JSX } from 'retend/jsx-runtime';

import { stripVTControlCharacters } from 'node:util';
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
import type {
  ProtocolPointValue,
  ProtocolPropertyValue,
} from './native/protocol.js';
import type { GpuiElementType, GpuiStyle } from './types.js';
import type { GpuiWindowOptions } from './window.js';

import {
  createNativeEvent,
  parseEventProperty,
  type NativeTransportEventId,
  type ParsedEventProperty,
} from './events.js';
import { GpuiHost } from './gpui-host.js';
import { peekNativeNodeId } from './native/node-id.js';
import {
  ElementKind,
  PropertyId,
  StyleState,
} from './native/protocol.generated.js';
import { withHMRBoundaries } from './plugins/hmr.js';
import {
  flattenGroups,
  GpuiAnchor,
  GpuiAnchoredElement,
  GpuiButtonElement,
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
const LOGICAL_SPACING_RANGE = [
  PropertyId.PaddingInline,
  PropertyId.MarginBlock,
] as const;
const TRANSITION_PROPERTY_RANGE = [
  PropertyId.TransitionProperty,
  PropertyId.TransitionTimingFunction,
] as const;
const IMAGE_PROPERTY_RANGE = [PropertyId.Src, PropertyId.ObjectFit] as const;
const PSEUDO_STATES = {
  hover: StyleState.Hover,
  focused: StyleState.Focused,
  active: StyleState.Active,
} as const;
type PseudoState = keyof typeof PSEUDO_STATES;
const ANCHORED_PROPERTY_BY_KEY = {
  side: PropertyId.AnchoredSide,
  align: PropertyId.AnchoredAlign,
  gap: PropertyId.AnchoredGap,
  fit: PropertyId.AnchoredFit,
  snapMargin: PropertyId.AnchoredSnapMargin,
  deferred: PropertyId.AnchoredDeferred,
  priority: PropertyId.AnchoredPriority,
  occlude: PropertyId.AnchoredOcclude,
} as const;

function propertyIdInRange(
  property: string,
  [minimum, maximum]: readonly [PropertyIdValue, PropertyIdValue]
): PropertyIdValue | undefined {
  const name = property[0]?.toUpperCase() + property.slice(1);
  const id = (PropertyId as Record<string, PropertyIdValue | undefined>)[name];
  return id !== undefined && id >= minimum && id <= maximum ? id : undefined;
}

function protocolStyleValue(
  property: string,
  value: unknown
): ProtocolPropertyValue {
  if (property === 'transitionProperty' && Array.isArray(value)) {
    if (!value.every((property) => typeof property === 'string')) {
      throw new TypeError('transitionProperty arrays must contain strings.');
    }
    return value.join(',');
  }
  return protocolPropertyValue(value);
}

type ElementFactory = new (
  id: number,
  host?: GpuiHost,
  renderer?: RetendGpuiRenderer
) => GpuiElement;

const ELEMENTS = {
  div: [ElementKind.Container, GpuiDivElement],
  img: [ElementKind.Image, GpuiImageElement],
  input: [ElementKind.Input, GpuiInputElement],
  textarea: [ElementKind.Textarea, GpuiTextareaElement],
  anchored: [ElementKind.Anchored, GpuiAnchoredElement],
  button: [ElementKind.Button, GpuiButtonElement],
} as const satisfies Record<
  GpuiElementType,
  readonly [ElementKindValue, ElementFactory]
>;

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

function protocolPoint(
  value: unknown,
  property: string
): ProtocolPointValue | null {
  if (value == null) return null;
  if (typeof value !== 'object') {
    throw new TypeError(`${property} must be an { x, y } object or null.`);
  }
  const x = Reflect.get(value, 'x');
  const y = Reflect.get(value, 'y');
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new TypeError(`${property} x and y must be numbers.`);
  }
  return [x, y];
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

interface DevelopmentErrorView {
  message: string;
  location: string;
  frame: string;
  stack: string;
}

function developmentErrorField(error: unknown, key: PropertyKey): unknown {
  if (
    (typeof error !== 'object' || error === null) &&
    typeof error !== 'function'
  )
    return undefined;
  try {
    return Reflect.get(error, key);
  } catch {
    return undefined;
  }
}

function cleanDevelopmentText(value: unknown): string {
  return typeof value === 'string' ? stripVTControlCharacters(value) : '';
}

function formatDevelopmentError(error: unknown): DevelopmentErrorView {
  const rawMessage =
    error instanceof Error
      ? error.message
      : cleanDevelopmentText(developmentErrorField(error, 'message')) ||
        (typeof error === 'string'
          ? error
          : (JSON.stringify(error, null, 2) ?? String(error)));
  let message = stripVTControlCharacters(rawMessage).trim();
  let frame = cleanDevelopmentText(
    developmentErrorField(error, 'frame')
  ).trim();

  if (!frame) {
    const newline = message.indexOf('\n');
    if (newline !== -1) {
      frame = message.slice(newline + 1).trim();
      message = message.slice(0, newline).trim();
    }
  }

  const plugin = cleanDevelopmentText(developmentErrorField(error, 'plugin'));
  if (plugin && !message.includes(`[plugin:${plugin}]`)) {
    message = `[plugin:${plugin}] ${message}`;
  }

  const id = cleanDevelopmentText(developmentErrorField(error, 'id'));
  const loc = developmentErrorField(error, 'loc');
  const line = Number(developmentErrorField(loc, 'line'));
  const column = Number(developmentErrorField(loc, 'column'));
  let location = id;
  if (id && Number.isFinite(line)) {
    location += `:${line}`;
    if (Number.isFinite(column)) location += `:${column}`;
  }

  if (!location && frame) {
    location =
      frame.match(/\[([^\]\n]+:\d+:\d+)\]/)?.[1] ??
      frame.match(/((?:[A-Za-z]:[\\/]|\/)[^\n()]+:\d+:\d+)/)?.[1] ??
      '';
  }

  const rawStack = cleanDevelopmentText(
    developmentErrorField(error, 'stack') ??
      (error instanceof Error ? error.stack : undefined)
  );
  const stackLines = rawStack.split('\n');
  const firstFrame = stackLines.findIndex((line) => /^\s*at\s/.test(line));
  const stack =
    firstFrame === -1
      ? ''
      : stackLines
          .slice(firstFrame, firstFrame + 10)
          .join('\n')
          .trim();

  return { message, location, frame, stack };
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
  #devError: GpuiElement | null = null;
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
    // A native close already destroyed the window's native subtree; release the
    // logical root, effects, and refs bound to it without issuing native work.
    this.host.addEventListener('close', () => this.#discardTree());
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
        before = this.#devError;
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
    let result: GpuiNode | GpuiNode[];
    try {
      result = withState(this.#state, () => {
        const normalized = normalizeJsxChild(app, this);
        const root = new GpuiRoot(this.host, this);
        this.#root = root;
        appendNodes(root, normalized);
        this.host.flush();
        return normalized;
      });
    } catch (error) {
      this.#abandonRoot();
      throw error;
    }
    return result;
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
  createContainer(tagName: 'anchored'): GpuiAnchoredElement;
  createContainer(tagName: 'img'): GpuiImageElement;
  createContainer(tagName: 'input'): GpuiInputElement;
  createContainer(tagName: 'textarea'): GpuiTextareaElement;
  createContainer(tagName: 'button'): GpuiButtonElement;
  createContainer(tagName: string): GpuiElement;
  createContainer(tagName: string): GpuiElement {
    const definition = ELEMENTS[tagName as GpuiElementType];
    if (!definition) {
      throw new Error(
        `Unsupported Retend GPUI intrinsic element: <${tagName}>. ` +
          'Supported tags are <div>, <anchored>, <img>, <input>, <textarea>, and <button>; text is ordinary JSX content.'
      );
    }

    const [kind, Factory] = definition;
    const id = this.host.createNode(kind);
    const node = new Factory(id, this.host, this);
    this.#nodesById.set(node.id, node);
    return node;
  }

  /** Creates a native text node. */
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

  /** Updates an existing text node; no-ops when it is destroyed or unchanged. */
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
      const target = value;
      // Install the cleanup before assigning so replacing the same ref does not
      // clear the assignment we are about to make.
      node.setCleanup('ref', () => {
        if (target.peek() === node) target.set(null);
      });
      target.set(node);
      return node;
    }

    if (Cell.isCell(value)) {
      const controller = new AbortController();
      node.setCleanup(`property:${key}`, () => controller.abort());
      this.#watchCell(value, controller.signal, (nextValue) =>
        this.#applyProperty(node, key, nextValue)
      );
      return node;
    }

    // Release any reactive binding this property previously held.
    node.clearCleanup(`property:${key}`);
    this.#applyProperty(node, key, value);
    return node;
  }

  /** Flattens a group into its constituent logical nodes. */
  unwrapGroup(group: GpuiGroup): GpuiNode[] {
    return [...flattenGroups(group.children)];
  }

  /** Appends logical children to a parent and syncs native children. */
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

  /** Replaces the content spanned by a range handle. */
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
    const details = formatDevelopmentError(error);
    if (this.#devError) this.clearDevelopmentError();

    const root = this.createContainer('div');
    const card = this.createContainer('div');
    const accent = this.createContainer('div');
    const content = this.createContainer('div');
    const divider = this.createContainer('div');

    this.setProperty(root, 'style', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      backgroundColor: '#00000099',
    });
    this.setProperty(card, 'style', {
      display: 'flex',
      flexDirection: 'column',
      width: '92%',
      maxWidth: 980,
      maxHeight: '90%',
      backgroundColor: '#181818',
      borderRadius: 10,
      overflow: 'hidden',
    });
    this.setProperty(accent, 'style', {
      width: '100%',
      height: 6,
      backgroundColor: '#ff5f5f',
    });
    this.setProperty(content, 'style', {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      gap: 14,
      padding: 24,
      overflow: 'auto',
      color: '#d5d5d5',
      backgroundColor: '#181818',
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
    });
    this.setProperty(divider, 'style', {
      width: '100%',
      height: 1,
      backgroundColor: '#3a3a3a',
    });

    const appendSection = (text: string, style: GpuiStyle): void => {
      if (!text) return;
      const section = this.createContainer('div');
      this.setProperty(section, 'style', style);
      this.append(section, this.createText(text));
      this.append(content, section);
    };

    appendSection(details.message, {
      color: '#ff6464',
      fontSize: 17,
      fontWeight: 'bold',
      lineHeight: 24,
    });
    appendSection(details.location, {
      color: '#63d8e8',
      fontSize: 13,
      lineHeight: 18,
    });
    appendSection(details.frame, {
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      padding: 14,
      borderRadius: 6,
      overflow: 'auto',
      backgroundColor: '#111111',
      color: '#e6bd68',
      whiteSpace: 'nowrap',
      fontSize: 13,
      lineHeight: 20,
    });
    appendSection(details.stack, {
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'auto',
      color: '#aaaaaa',
      whiteSpace: 'nowrap',
      fontSize: 12,
      lineHeight: 18,
    });
    this.append(content, divider);
    appendSection('Fix the code to dismiss this overlay.', {
      color: '#8f8f8f',
      fontSize: 12,
      lineHeight: 18,
    });

    this.append(card, accent);
    this.append(card, content);
    this.append(root, card);
    this.#devError = root;
    try {
      if (!this.#mountedNativeRoots.has(root)) {
        this.host.insertChild(this.host.rootId, root.id);
        this.#mountedNativeRoots.add(root);
      }
      this.flush();
    } catch (error) {
      this.#mountedNativeRoots.delete(root);
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
    const root = this.#devError;
    if (!root) return;

    this.#devError = null;
    // Application roots stay mounted underneath; removing the overlay uncovers
    // them unchanged.
    if (this.#mountedNativeRoots.delete(root)) {
      this.host.removeChild(this.host.rootId, root.id);
    }
    this.#markDestroyedSubtree(root);
    this.host.settle();
  }

  /**
   * @internal Runs speculative node creation and destroys any newly-created
   * unattached nodes if the operation throws.
   */
  withNodeRollback<T>(operation: () => T): T {
    // IDs are monotonic and never reused, so the next unallocated ID separates
    // committed nodes from those created during this synchronous operation.
    const watermark = peekNativeNodeId();
    try {
      return operation();
    } catch (error) {
      const created = [...this.#nodesById.values()].filter(
        (node) => node.id >= watermark
      );
      const createdSet = new Set<GpuiNode>(created);
      const roots = created.filter(
        (node) =>
          !hasAncestor(node.parent, (ancestor) => createdSet.has(ancestor))
      );
      for (const root of roots) {
        if (root.destroyed) continue;
        // Cycling an unattached root through the immutable window root makes it
        // settlement-eligible without a separate destroy opcode.
        this.host.insertChild(this.host.rootId, root.id);
        this.host.removeChild(this.host.rootId, root.id);
      }
      for (const root of roots) this.#markDestroyedSubtree(root);
      if (roots.length > 0) this.host.settle();
      throw error;
    }
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

  /**
   * Tears down a root whose initial render failed, including any nodes already
   * committed to the native tree by an explicit or implicit flush.
   */
  #abandonRoot(): void {
    let nativeUsable = true;
    try {
      this.host.flush();
    } catch {
      nativeUsable = false;
      this.host.discardPendingCommands();
    }
    const roots = this.#takeOwnedRoots();
    if (nativeUsable) {
      for (const root of roots) {
        if (root.destroyed) continue;
        this.host.insertChild(this.host.rootId, root.id);
        this.host.removeChild(this.host.rootId, root.id);
      }
    }
    this.#destroyOwnedNodes(roots);
    if (nativeUsable) this.host.settle();
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
        // Install the cleanup before invoking so replacing the same callback
        // ends with the callback bound to this node.
        node.setCleanup('ref', () => callback(null));
        callback(node);
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

    if (node.tagName === 'anchored') {
      if (key === 'position' || key === 'offset') {
        this.host.setProperty(
          node.id,
          key === 'position'
            ? PropertyId.AnchoredPosition
            : PropertyId.AnchoredOffset,
          protocolPoint(value, key)
        );
        return;
      }
      const anchoredProperty =
        ANCHORED_PROPERTY_BY_KEY[key as keyof typeof ANCHORED_PROPERTY_BY_KEY];
      if (anchoredProperty !== undefined) {
        this.host.setProperty(
          node.id,
          anchoredProperty,
          protocolPropertyValue(value)
        );
        return;
      }
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
    else if (
      (node.tagName === 'input' || node.tagName === 'textarea') &&
      key === 'placeholder'
    )
      property = PropertyId.Placeholder;
    else if (node.tagName === 'textarea' && key === 'minRows')
      property = PropertyId.MinRows;
    else if (node.tagName === 'textarea' && key === 'maxRows')
      property = PropertyId.MaxRows;
    else if (node.tagName === 'button' && key === 'disabled')
      property = PropertyId.Disabled;
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
      node.clearCleanup(cleanupKey);
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

    const priorStates = new Set(
      (Object.keys(PSEUDO_STATES) as PseudoState[]).filter(
        (state) => node.style[state] !== undefined
      )
    );
    const resolved: Record<string, unknown> = {};
    node.style = resolved as GpuiStyle;
    let initializing = true;
    const bindDeclaration = (
      property: string,
      propertyValue: unknown,
      target: Record<string, unknown>,
      state?: PseudoState
    ): void => {
      if (!Cell.isCell(propertyValue)) {
        target[property] = propertyValue;
        return;
      }
      this.#watchCell(propertyValue, controller.signal, (nextValue) => {
        target[property] = nextValue;
        if (!initializing && !node.destroyed) this.#publishStyle(node, state);
      });
    };

    if (value && typeof value === 'object') {
      for (const [property, propertyValue] of Object.entries(value)) {
        if (!(property in PSEUDO_STATES)) {
          bindDeclaration(property, propertyValue, resolved);
          continue;
        }
        if (!propertyValue || typeof propertyValue !== 'object') continue;
        const pseudo: Record<string, unknown> = {};
        resolved[property] = pseudo;
        for (const [name, pseudoValue] of Object.entries(propertyValue)) {
          bindDeclaration(name, pseudoValue, pseudo, property as PseudoState);
        }
      }
    }

    initializing = false;
    if (!controller.signal.aborted && !node.destroyed) {
      this.#publishStyle(node);
      for (const state of Object.keys(PSEUDO_STATES) as PseudoState[]) {
        if (resolved[state] !== undefined || priorStates.has(state))
          this.#publishStyle(node, state);
      }
    }
  }

  #publishStyle(node: GpuiElement, state?: PseudoState): void {
    const source = state ? (node.style[state] ?? {}) : node.style;
    const properties: [PropertyIdValue, ProtocolPropertyValue][] = [];
    for (const [property, value] of Object.entries(source)) {
      if (value === undefined || (!state && property in PSEUDO_STATES))
        continue;
      const id =
        propertyIdInRange(property, STYLE_PROPERTY_RANGE) ??
        propertyIdInRange(property, LOGICAL_SPACING_RANGE) ??
        propertyIdInRange(property, TRANSITION_PROPERTY_RANGE);
      if (id === undefined) {
        throw new Error(`Unsupported Retend GPUI style property: ${property}.`);
      }
      properties.push([id, protocolStyleValue(property, value)]);
    }
    if (!state) this.host.setStyle(node.id, properties);
    else this.host.setPseudoStyle(node.id, PSEUDO_STATES[state], properties);
  }

  #watchCell(
    cell: Cell<unknown>,
    signal: AbortSignal,
    update: (value: unknown) => void
  ): void {
    if (cell instanceof AsyncCell) useAwait()?.waitUntil(cell);
    // Only the newest emitted value may apply. Without this guard an older
    // Promise resolution can overwrite a newer synchronous update.
    let version = 0;
    const resolve = (value: unknown, token: number): void => {
      if (signal.aborted || token !== version) return;
      if (value instanceof Promise) {
        void value.then(
          (resolved) => resolve(resolved, token),
          (error: unknown) => {
            if (!signal.aborted && token === version) {
              console.error(
                '[retend-gpui] reactive value update failed:',
                error
              );
              this.host.reportApplicationError(error);
            }
          }
        );
      } else update(value);
    };
    const apply = (value: unknown): void => {
      version += 1;
      resolve(value, version);
    };
    apply(cell.get());
    cell.listen(apply, { signal });
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
  try {
    await renderer.mount(App);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  return renderer;
}

export {
  GpuiAnchor,
  GpuiAnchoredElement,
  GpuiButtonElement,
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

import type { Cell } from '@adbl/cells';

import type { Environments } from '../context/index.js';
import type { JSX } from '../jsx-runtime/index.js';
import type { Observer } from './observer.js';
import type { __HMR_UpdatableFn, StateSnapshot } from './scope.js';

/**
 * A registry of concrete types specific to a renderer implementation.
 * This structure allows the core framework to maintain type safety while
 * remaining decoupled from the host-specific node and handle implementations.
 */
export interface RendererTypes {
  /** The fundamental unit of the renderer's output. */
  Node: any;
  /** A reference used to track and update a dynamic collection of nodes within the output. */
  Handle: any;
  /** A logical container for a set of nodes that doesn't necessarily correspond to a host-level entity. */
  Group: any;
  /** A specific node type for representing plain text content. */
  Text: any;
  /** A host-level entity capable of containing other nodes. */
  Container: any;
  /** The target environment or main interface where the renderer operates. */
  Host: EventTarget extends infer T ? T : EventTarget;
}

/**
 * A collection of flags defining the feature set and constraints of a renderer.
 * These are used by the framework to conditionally enable optimizations or
 * alternative execution paths based on what the host environment supports.
 */
export interface Capabilities {
  /** Whether the renderer supports executing setup effects. */
  supportsSetupEffects?: boolean;
  /** Whether the renderer supports the observer.onConnected API */
  supportsObserverConnectedCallbacks?: boolean;
}

/**
 * Options used by the reconciler to efficiently update a list of nodes.
 */
export interface ReconcilerOptions<Node> {
  /** A function to retrieve or generate a unique key for an item in the list. */
  retrieveOrSetItemKey: (item: any, i: number) => any;
  /** Callback invoked just before a node is removed from the host environment. */
  onBeforeNodeRemove?: (node: Node, fromIndex: number) => void;
  /** Callback invoked just before a set of nodes are moved within the host environment. */
  onBeforeNodeMove?: (nodes: Node[]) => void;
  /** The cache of data from the previous rendering run. */
  cacheFromLastRun: Map<any, ForCachedData<Node>>;
  /** The new cache being built during the current rendering run. */
  newCache: Map<any, ForCachedData<Node>>;
  /** The new list of items that the nodes should represent. */
  newList: Iterable<any>;
  /** A map used for look-ahead optimizations to minimize unnecessary moves. */
  nodeLookAhead: Map<unknown, { itemKey: any; lastItemLastNode: Node | null }>;
}

/**
 * Cached data for rendering lists.
 */
export interface ForCachedData<Node> {
  index: Cell<number>;
  nodes: Node[];
  snapshot: StateSnapshot;
}

/**
 * The core interface for a rendering engine, acting as an abstract bridge between
 * the framework's reactive logic and a specific host environment.
 *
 * A renderer is responsible for orchestrating the creation, mutation, and reconciliation
 * of nodes within its target output. It abstracts away the platform-specific
 * implementation details (such as DOM manipulation, string serialization, or graphics rendering)
 * allowing the core framework to remain platform-agnostic.
 */
export interface Renderer<
  Types extends RendererTypes,
  Node = Types['Node'],
  Container extends Node = Types['Container'],
  Group extends Node = Types['Group'],
  Handle extends Node = Types['Handle'],
  Text extends Node = Types['Text'],
  Host = Types['Host'],
> {
  /** The instance of the host environment where the renderer is operating. */
  host: Host;
  /** An observer instance for watching the node environment and firing callbacks on renderer-defined connections. */
  observer: Observer | null;
  /** Renders a JSX template and returns the resulting node(s). */
  render(app: JSX.Template): Node | Node[];
  /** Configuration flags indicating which features this renderer supports. */
  capabilities: Capabilities;
  /** A predicate that identifies if a value is a valid node for this renderer. */
  isNode(child: any): child is Node;
  /** Creates a virtual collection to group nodes without requiring a host-level container. */
  createGroup(): Group;
  /** A predicate that identifies if a node is a logical group. */
  isGroup(child: any): child is Group;
  /** Creates a host-level entity with the specified name and properties. */
  createContainer(tagname: string, props?: any): Container;
  /** Instantiates a text node from a string. */
  createText(text: string, isReactive?: boolean, isPending?: boolean): Node;
  /** Mutates the content of an existing text node. */
  updateText(text: string, node: Text): Node;
  /** Applies a property or reactive value to a node. */
  setProperty<N extends Node>(node: N, key: string, value: unknown): N;
  /** Flattens a Group node back into its constituent nodes. */
  unwrapGroup(fragment: Group): Node[];
  /** Physically attaches nodes to a container in the host environment. */
  append(parent: Node, children: Node | Node[]): Node;
  /** Checks if a node is "active". Activity of a node is renderer-defined. */
  isActive(node: Node): boolean;
  /** Creates a stable reference (handle) to a group of nodes, enabling subsequent incremental updates. */
  createGroupHandle(group: Group): Handle;
  /** Synchronously replaces the current nodes associated with a handle with new content. */
  write(handle: Handle, newContent: Node[]): void;
  /** Efficiently updates the nodes associated with a handle by diffing them against a new list of items. */
  reconcile(handle: Handle, options: ReconcilerOptions<Node>): void;
  /** Orchestrates the execution of components. */
  handleComponent(
    tagnameOrFunction: __HMR_UpdatableFn,
    props: any[],
    snapshot?: StateSnapshot,
    fileData?: JSX.JSXDevFileData
  ): Node | Node[];
  /** Saves the current state of a handle to the renderer's snapshot store. */
  save(handle: Handle): number;
  /** Restores a handle's state from the renderer's snapshot store. */
  restore(id: number, handle: Handle): void;
}

/**
 * Retrieves the currently active renderer from the global context.
 *
 * @returns The renderer instance responsible for the current execution cycle.
 */
export function getActiveRenderer(): Renderer<any>;

/**
 * Sets the active renderer within the global context.
 *
 * @param renderer - The renderer instance to be used for subsequent rendering operations.
 * @param context - Optional environment context to set the renderer on.
 */
export function setActiveRenderer<Types extends RendererTypes>(
  renderer: Renderer<Types>,
  context?: Environments
): void;

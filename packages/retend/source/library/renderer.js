/** @import { jsxDevFileData, UpdatableFn } from '../hmr/index.js'; */
/** @import { ScopeSnapshot } from '../library/scope.js'; */
/** @import { Cell } from '@adbl/cells'; */
/** @import { Observer } from './observer.js'; */

import { getGlobalContext } from '../context/index.js';
const RendererKey = Symbol('Renderer');

/**
 * A registry of concrete types specific to a renderer implementation.
 * This structure allows the core framework to maintain type safety while
 * remaining decoupled from the host-specific node and handle implementations.
 *
 * @typedef RendererTypes
 * @property {any} Output
 * The final result of the rendering process.
 *
 * @property {any} Node
 * The fundamental unit of the renderer's output.
 *
 * @property {any} Handle
 * A reference used to track and update a dynamic collection of nodes within the output.
 *
 * @property {any} Group
 * A logical container for a set of nodes that doesn't necessarily correspond to a host-level entity.
 *
 * @property {any} Text
 * A specific node type for representing plain text content.
 *
 * @property {any} Container
 * A host-level entity capable of containing other nodes.
 *
 * @property {EventTarget extends infer T ? T : EventTarget} Host
 * The target environment or main interface where the renderer operates.
 *
 * @property {any} SavedNodeState
 * A serializable or structured representation of a node's state, used for preservation and restoration.
 *//**
 * A collection of flags defining the feature set and constraints of a renderer.
 * These are used by the framework to conditionally enable optimizations or
 * alternative execution paths based on what the host environment supports.
 *
 * @typedef Capabilities
 * @property {boolean} [supportsSetupEffects]
 * Whether the renderer supports executing setup effects.
 * @property {boolean} [supportsObserverConnectedCallbacks]
 * Whether the renderer supports the observer.onConnected API
 */

/**
 * @typedef UnknownRendererTypes
 * @property {unknown} Output
 * @property {unknown} Node
 * @property {unknown} Handle
 * @property {unknown} Group
 * @property {unknown} Text
 * @property {unknown} Container
 * @property {any} Host
 * @property {any} SavedNodeState
 */

/**
 * The core interface for a rendering engine, acting as an abstract bridge between
 * the framework's reactive logic and a specific host environment.
 *
 * A renderer is responsible for orchestrating the creation, mutation, and reconciliation
 * of nodes within its target output. It abstracts away the platform-specific
 * implementation details (such as DOM manipulation, string serialization, or graphics rendering)
 * allowing the core framework to remain platform-agnostic.
 *
 * @template {RendererTypes} out Types
 * The concrete types used by this renderer.
 *
 * @template [Node=Types['Node']]
 * The base node type.
 *
 * @template [Output=Types['Output']]
 * The final output type.
 *
 * @template {Node} [Container=Types['Container']]
 * A node that can contain other nodes.
 *
 * @template {Node} [Group=Types['Group']]
 * A logical grouping of nodes.
 *
 * @template {Node} [Handle=Types['Handle']]
 * A reference to a managed collection of nodes.
 *
 * @template {Node} [Text=Types['Text']]
 * A node representing text.
 *
 * @template [out Host=Types['Host']]
 * The host environment.
 *
 * @template [SavedNodeState=Types['SavedNodeState']]
 * The type for saved node state.
 *
 * @typedef Renderer
 *
 * @property {Host} host
 * The instance of the host environment where the renderer is operating.
 *
 * @property {Observer | null} observer
 * An observer instance for watching the node environment and firing callbacks
 * on renderer-defined connections.
 *
 * @property {(callback: () => void) => void} onViewChange
 *
 * @property {Capabilities} capabilities
 * Configuration flags indicating which features this renderer supports.
 *
 * @property {(child: any) => child is Node} isNode
 * A predicate that identifies if a value is a valid node for this renderer.
 *
 * @property {(input?: Node[]) => Group} createGroup
 * Creates a virtual collection to group nodes without requiring a host-level container.
 *
 * @property {(child: any) => child is Group} isGroup
 * A predicate that identifies if a node is a logical group.
 *
 * @property {(tagname: string, props?: any) => Container} createContainer
 * Creates a host-level entity with the specified name and properties.
 *
 * @property {(text: string) => Node} createText
 * Instantiates a text node from a string.
 *
 * @property {(text: string, node: Node) => Node} updateText
 * Mutates the content of an existing text node.
 *
 * @property {<N extends Node>(node: N, key: string, value: unknown) => N} setProperty
 * Applies a property or reactive value to a node.
 *
 * @property {(promise: Promise<any>) => Node} handlePromise
 * Manages the lifecycle of a node that resolves asynchronously.
 *
 * @property {(fragment: Group) => Node[]} unwrapGroup
 * Flattens a Group node back into its constituent nodes.
 *
 * @property {(parent: Node, children: Node | Node[]) => Node} append
 * Physically attaches nodes to a container in the host environment.
 *
 * @property {(node: Node) => boolean} isActive
 * Checks if a node is "active". Activity of a node is renderer-defined. When a node
 * is active, it fires its associated observer.onConnected callback.
 *
 * @property {(group: Group) => Handle} createGroupHandle
 * Creates a stable reference (handle) to a group of nodes, enabling subsequent incremental updates.
 *
 * @property {(handle: Handle, newContent: Node[]) => void} write
 * Synchronously replaces the current nodes associated with a handle with new content.
 *
 * @property {(handle: Handle, options: ReconcilerOptions<Node>) => void} reconcile
 * Efficiently updates the nodes associated with a handle by diffing them against a new list of items.
 *
 * @property {(node: Node) => Output} finalize
 * Performs the final transformation on the produced output before returning it to the user.
 *
 * @property {(tagnameOrFunction: UpdatableFn, props: any, fileData?: jsxDevFileData) => Node} handleComponent
 * Orchestrates the execution of components.
 *
 * @property {(key: string) => Node | null} selectMatchingNode
 * Locates a node in the host environment by its unique key.
 *
 * @property {(key: string) => Node[]} selectMatchingNodes
 * Locates all nodes in the host environment matching a specific key.
 *
 * @property {(node: Container, customData: unknown) => SavedNodeState} saveContainerState
 * Captures the current state of a container node to be restored later.
 *
 * @property {(node: Container, state: SavedNodeState) => void} restoreContainerState
 * Re-applies a previously saved state to a container node.
 */

/**
 * @template Node
 * @typedef {{ index: Cell<number>,  nodes: Node[], snapshot: ScopeSnapshot }} ForCachedData
 */

/**
 * Options used by the reconciler to efficiently update a list of nodes.
 *
 * @template Node
 * @typedef {Object} ReconcilerOptions
 *
 * @property {(item: any, i: number) => any} retrieveOrSetItemKey
 * A function to retrieve or generate a unique key for an item in the list.
 *
 * @property {(node: Node, fromIndex: number) => void} [onBeforeNodeRemove]
 * Callback invoked just before a node is removed from the host environment.
 *
 * @property {(nodes: Node[]) => void} [onBeforeNodeMove]
 * Callback invoked just before a set of nodes are moved within the host environment.
 *
 * @property {Map<any, ForCachedData<Node>>} cacheFromLastRun
 * The cache of data from the previous rendering run.
 *
 * @property {Map<any, ForCachedData<Node>>} newCache
 * The new cache being built during the current rendering run.
 *
 * @property {Iterable<any>} newList
 * The new list of items that the nodes should represent.
 *
 * @property {Map<unknown, { itemKey: any, lastItemLastNode: Node | null }>} nodeLookAhead
 * A map used for look-ahead optimizations to minimize unnecessary moves.
 */

/**
 * Retrieves the currently active renderer from the global context.
 *
 * @returns {Renderer<UnknownRendererTypes>}
 * The renderer instance responsible for the current execution cycle.
 */
export function getActiveRenderer() {
  const { globalData } = getGlobalContext();
  const renderer = globalData.get(RendererKey);
  return renderer;
}

/**
 * Sets the active renderer within the global context.
 *
 * @template {RendererTypes} Types
 * @param {Renderer<Types>} renderer
 * The renderer instance to be used for subsequent rendering operations.
 */
export function setActiveRenderer(renderer) {
  const { globalData } = getGlobalContext();
  globalData.set(RendererKey, renderer);
}

/** @import { jsxDevFileData, UpdatableFn } from '../hmr/index.js'; */
/** @import { ScopeSnapshot } from '../library/scope.js'; */
/** @import { Cell } from '@adbl/cells'; */

import { getGlobalContext } from '../context/index.js';
const RendererKey = Symbol('Renderer');

/**
 * Defines the concrete types used by a specific renderer implementation.
 * @typedef RendererTypes
 * @property {any} Output
 * @property {any} Node
 * @property {any} Handle
 * @property {any} Group
 * @property {any} Text
 * @property {any} Container
 * @property {EventTarget} Host
 * @property {any} SavedNodeState
 */

/**
 * @typedef Capabilities
 * @property {boolean} [supportsSetupEffects]
 */

/**
 * @typedef UnknownRendererTypes
 * @property {unknown} Output
 * @property {unknown} Node
 * @property {unknown} Handle
 * @property {unknown} Group
 * @property {unknown} Text
 * @property {unknown} Container
 * @property {EventTarget} Host
 * @property {{ data: unknown }} SavedNodeState
 */

/**
 * @template {RendererTypes} Types
 * @template [Node=Types['Node']]
 * @template [Output=Types['Output']]
 * @template {Node} [Container=Types['Container']]
 * @template {Node} [Group=Types['Group']]
 * @template {Node} [Handle=Types['Handle']]
 * @template {Node} [Text=Types['Text']]
 * @template [Host=Types['Host']]
 * @template [SavedNodeState=Types['SavedNodeState']]
 *
 * @typedef Renderer
 *
 * @property {Host} host
 * @property {Capabilities} capabilities
 *
 * @property {(child: any) => child is Node} isNode
 * A predicate that identifies if a value is a valid node.
 *
 * @property {(input?: Node[]) => Group} createGroup
 * Creates a virtual collection to group nodes without a container.
 *
 * @property {(child: any) => child is Group} isGroup
 * A predicate that identifies if a node is a logical group.
 *
 * @property {(tagname: string, props?: any) => Container} createContainer
 * Creates a host-level element.
 *
 * @property {(text: string) => Node} createText
 * Instantiates a text node.
 *
 * @property {(text: string, node: Node) => Node} updateText
 * Mutates the content of an existing text node.
 *
 * @property {<N extends Node>(node: N, key: string, value: unknown) => N} setProperty
 * Applies a property or attribute to a node.
 *
 * @property {(promise: Promise<any>) => Node} handlePromise
 * Manages the lifecycle of a node that is resolved asynchronously.
 *
 * @property {(fragment: Group) => Node[]} unwrapGroup
 * Flattens a Group node back into its constituent array of nodes.
 *
 * @property {(parent: Node, children: Node | Node[]) => Node} append
 * Physically attaches a child node (or multiple) to a parent container in the host tree.
 *
 * @property {(group: Group) => Handle} createGroupHandle
 *
 * @property {(handle: Handle, newContent: Node[]) => void} write
 *
 * @property {(handle: Handle, options: ReconcilerOptions<Node>) => void} reconcile
 *
 * @property {(node: Node) => Output} finalize
 * Performs the final transformation on the produced node tree before returning it to the user.
 *
 * @property {(tagnameOrFunction: UpdatableFn, props: any, fileData?: jsxDevFileData) => Node} handleComponent
 * Orchestrates the execution of functional components, including hook initialization
 * and HMR (Hot Module Replacement) boundary setup.
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
 * @template Node
 * @typedef {Object} ReconcilerOptions
 *
 * @property {(item: any, i: number) => any} retrieveOrSetItemKey
 *
 * @property {(node: Node, fromIndex: number) => void} [onBeforeNodeRemove]
 * Callback invoked before a node is removed from the DOM.
 *
 * @property {(node: Node[]) => void} [onBeforeNodeMove]
 * Callback invoked before nodes are moved within the DOM.
 *
 * @property {Map<any, ForCachedData<Node>>} cacheFromLastRun
 * @property {Map<any, ForCachedData<Node>>} newCache
 * @property {Iterable<any>} newList
 * @property {Map<unknown, { itemKey: any, lastItemLastNode: Node | null }>} nodeLookAhead
 */

/**
 * @returns {Renderer<UnknownRendererTypes>}
 */
export function getActiveRenderer() {
  const { globalData } = getGlobalContext();
  const renderer = globalData.get(RendererKey);
  return renderer;
}

/**
 * @template {RendererTypes} Types
 * @param {Renderer<Types>} renderer
 */
export function setActiveRenderer(renderer) {
  const { globalData } = getGlobalContext();
  globalData.set(RendererKey, renderer);
}

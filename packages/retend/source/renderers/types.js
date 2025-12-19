/** @import { jsxDevFileData, UpdatableFn } from '../library/hmr.js'; */
/** @import { ScopeSnapshot } from '../library/scope.js'; */
/** @import { Cell } from '@adbl/cells'; */

/**
 * Defines the concrete types used by a specific renderer implementation.
 * @typedef RendererTypes
 * @property {any} Output - The final result of the rendering process (e.g., a string or a Root DOM node).
 * @property {any} Node - The base type for all renderable entities in the host environment.
 * @property {any} Segment - A living, mutable sequence of nodes.
 * @property {any} Group - A logical collection of nodes that doesn't create a host-level element (e.g. Fragments).
 * @property {any} Text - The specific node type for representing text.
 * @property {any} Container - A collection of nodes logically belonging to a single 'parent'.
 */

/**
 * @typedef UnknownRendererTypes
 * @property {unknown} Output
 * @property {unknown} Node
 * @property {unknown} Segment
 * @property {unknown} Group
 * @property {unknown} Text
 * @property {unknown} Container
 */

/**
 * @template {RendererTypes} Types
 * @template [Node=Types['Node']]
 * @template [Output=Types['Output']]
 * @template {Node} [Container=Types['Container']]
 * @template {Node} [Group=Types['Group']]
 * @template {Node} [Handle=Types['Segment']]
 * @template {Node} [Text=Types['Text']]
 * @typedef Renderer
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

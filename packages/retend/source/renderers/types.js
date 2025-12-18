/** @import { jsxDevFileData, UpdatableFn } from '../plugin/hmr.js'; */

/**
 * @typedef RendererData
 * @property {any} Output
 * @property {any} Node
 * @property {any} Segment
 * @property {any} Group
 * @property {any} Text
 */

/**
 * @template {RendererData} Types
 * @template [Node=Types['Node']]
 * @template [Output=Types['Output']]
 * @template {Node} [Group=Types['Group']]
 * @template {Node} [Segment=Types['Segment']]
 * @template {Node} [Text=Types['Text']]
 * @typedef  Renderer
 * @property {(input?: Node[]) => Node} createGroup
 * @property {(child: any) => child is Group} isGroup
 * @property {(child: any) => child is Node} isNode
 * @property {(tagname: string, props?: any) => Node} createContainer
 * @property {(text: string) => Node} createText
 * @property {(text: string, node: Node) => Node} updateText
 * @property {(node: Node, key: string, value: unknown) => Node} setProperty
 * @property {(promise: Promise<any>) => Node} handlePromise
 * @property {(fragment: Group) => Node[]} unwrapNodeGroup
 * @property {(parent: Node, children: Node | Node[]) => Node} append
 * @property {() => Segment} createSegment
 * @property {(child: any) => child is Segment} isSegment
 * @property {(node: Node) => Output} finalize
 * @property {(tagnameOrFunction: UpdatableFn, props: any, fileData?: jsxDevFileData) => Node} handleComponent
 */

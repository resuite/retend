/** @import { jsxDevFileData, UpdatableFn } from '../plugin/hmr.js'; */

/**
 * @template Node, Output
 * @typedef BaseRendererProperties
 * @property {(input?: Node[]) => Node} createFragment
 * @property {(child: any) => boolean} isFragment
 * @property {(child: any) => child is Node} isNode
 * @property {(tagname: string, namespace?: string) => Node} createElement
 * @property {(text: string) => Node} createText
 * @property {(node: Node, key: string, value: unknown) => Node} setProperty
 * @property {(promise: Promise<any>) => Node} handlePromise
 * @property {(fragment: any) => Node[]} unwrapFragment
 * @property {(parent: Node, children: Node | Node[]) => Node} append
 * @property {(node: Node) => Output} finalize
 * @property {(tagnameOrFunction: UpdatableFn, props: any, fileData?: jsxDevFileData) => Node} renderComponent
 */

/**
 * @template Node
 * @typedef InteractiveRendererProperties
 * @property {true} isInteractive
 * @property {(text: string, node: Node) => Node} setText
 */

/**
 * @typedef StaticRendererProperties
 * @property {false} isInteractive
 */

/**
 * @template Node, Output
 * @typedef {BaseRendererProperties<Node, Output> & InteractiveRendererProperties<Node>} InteractiveRenderer
 */

/**
 * @template Node, Output
 * @typedef {BaseRendererProperties<Node, Output> & StaticRendererProperties} StaticRenderer
 */

/**
 * @template Node, Output
 * @typedef {StaticRenderer<Node, Output> | InteractiveRenderer<Node, Output>} Renderer
 */

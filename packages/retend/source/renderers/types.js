/** @import { jsxDevFileData, UpdatableFn } from '../plugin/hmr.js'; */

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * @typedef BaseRendererProperties
 * @property {(input?: NodeType[]) => NodeType} createNodeGroup
 * @property {(child: any) => child is Group} isGroup
 * @property {(child: any) => child is NodeType} isNode
 * @property {(tagname: string, namespace?: string) => NodeType} createElement
 * @property {(text: string) => NodeType} createText
 * @property {(node: NodeType, key: string, value: unknown) => NodeType} setProperty
 * @property {(promise: Promise<any>) => NodeType} handlePromise
 * @property {(fragment: Group) => NodeType[]} unwrapNodeGroup
 * @property {(parent: NodeType, children: NodeType | NodeType[]) => NodeType} append
 * @property {(node: NodeType) => Output} finalize
 * @property {(tagnameOrFunction: UpdatableFn, props: any, fileData?: jsxDevFileData) => NodeType} handleComponent
 */

/**
 * @template NodeType
 * @typedef InteractiveRendererProperties
 * @property {true} isInteractive
 * @property {(text: string, node: NodeType) => NodeType} setText
 */

/**
 * @typedef StaticRendererProperties
 * @property {false} isInteractive
 */

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * @typedef {BaseRendererProperties<NodeType, Output, Group> & InteractiveRendererProperties<NodeType>} InteractiveRenderer
 */

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * @typedef {BaseRendererProperties<NodeType, Output, Group> & StaticRendererProperties} StaticRenderer
 */

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * @typedef {StaticRenderer<NodeType, Output, Group> | InteractiveRenderer<NodeType, Output, Group>} Renderer
 */

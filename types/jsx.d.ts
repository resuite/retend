/**
 * Creates a new DOM element with the specified tag name, props, and children.
 *
 * @template {Record<PropertyKey, any>} Props
 * @template {string | ((props: Props & { children: any } | typeof DocumentFragment, context: any) => Node | Promise<Node>)} TagName
 * @param {TagName} tagname - The HTML tag name for the element.
 * @param {Props} props - An object containing the element's properties.
 * @param {...*} children - The child elements of the element.
 * @returns {Node} A new virtual DOM element.
 */
export function h<Props extends Record<PropertyKey, any>, TagName extends string | ((props: (Props & {
    children: any;
}) | typeof DocumentFragment, context: any) => Node | Promise<Node>)>(tagname: TagName, props: Props, ...children: any[]): Node;
/**
 * @typedef HiddenElementProperties
 * @property {Map<string, () => void>} __eventListenerList
 * List of event listeners set as attributes on the element.
 * @property {Set<object | ((value: any) => void)>} __attributeCells
 * List of cell callbacks set as attributes on the element.
 * @property {boolean} __createdByJsx
 * Whether or not the element was created using JSX syntax.
 * @property {string | boolean | number | undefined} __key
 * Unique key for the element.
 * @property {object} __finalProps
 * Props passed to the element.
 */
/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 *
 */
/**
 * Sets an attribute on an element based on the provided props.
 *
 * @param {JsxElement} element - The DOM element to set the attribute on.
 * @param {string} key - The name of the attribute to set.
 * @param {any} value - The value to set for the attribute. Can be a primitive value or an object with a `runAndListen` method.
 *
 * @description
 * If the value is an object with a `runAndListen` method, it sets up a reactive attribute.
 * Otherwise, it directly sets the attribute on the element.
 */
export function setAttributeFromProps(element: JsxElement, key: string, value: any): void;
/**
 * Sets an attribute on an element.
 * @param {JsxElement} element - The element to set the attribute on.
 * @param {string} key - The name of the attribute.
 * @param {any} value - The value of the attribute.
 */
export function setAttribute(element: JsxElement, key: string, value: any): void;
/**
 * Normalizes a child jsx element for use in the DOM.
 * @param {Node | Array<any> | string | number | boolean | object | undefined | null} child - The child element to normalize.
 * @param {Node} [_parent] - The parent node of the child.
 * @returns {Node} The normalized child element.
 */
export function normalizeJsxChild(child: Node | Array<any> | string | number | boolean | object | undefined | null, _parent?: Node | undefined): Node;
/**
 * Defines the `__jsx` and `__jsxFragment` global functions
 * for computing JSX components.
 */
export function defineJsxGlobals(): void;
export class DocumentFragmentPlaceholder {
}
export default h;
export type HiddenElementProperties = {
    /**
     * List of event listeners set as attributes on the element.
     */
    __eventListenerList: Map<string, () => void>;
    /**
     * List of cell callbacks set as attributes on the element.
     */
    __attributeCells: Set<object | ((value: any) => void)>;
    /**
     * Whether or not the element was created using JSX syntax.
     */
    __createdByJsx: boolean;
    /**
     * Unique key for the element.
     */
    __key: string | boolean | number | undefined;
    /**
     * Props passed to the element.
     */
    __finalProps: object;
};
export type JsxElement = Element & HiddenElementProperties;

/** @import { JsxElement } from '@adbl/unfinished' */
/** @import { VNode } from '@adbl/unfinished/v-dom' */
/** @import { Router } from '@adbl/unfinished/router' */
/** @import { ServerContext } from './types.js' */

import {
  Modes,
  setAttributeFromProps,
  setGlobalContext,
  useObserver,
} from '@adbl/unfinished';
import {
  HydrationUpgradeEvent,
  VComment,
  VElement,
  VWindow,
} from '@adbl/unfinished/v-dom';
import { SourceCell } from '@adbl/cells';

/**
 * Re-enables the interactive features of a server-side rendered application.
 *
 * This function is the entry point for client-side hydration, taking a `routerModule`,
 * and using it to re-initialize the application's router,
 * attaching it to the existing static HTML. This process makes the app
 * interactive without a full page reload, improving user experience.
 *
 * @param {() => Router} routerFn - The function used to create the router
 * on the server.
 * @returns {Promise<Router>} The re-initiated instance of the router used to create the application.
 *   This allows you to interact with the router programmatically after hydration.
 *
 * @example
 * // In your main client-side entry point (e.g., index.js or app.js):
 * import { hydrate } from '@adbl/unfinished-ssg/client';
 * import { createRouter } from './router';
 *
 * hydrate(createRouter)
 *   .then(() => {
 *     console.log('Application successfully hydrated!');
 *   })
 *   .catch((error) => {
 *     console.error('Hydration failed:', error);
 *   });
 *
 * @remarks
 *  **Important:** For `hydrate` to work correctly, your server-side rendering must
 *  include a `<script>` tag with the `data-server-context` attribute. This script
 *  tag contains the server-rendered context as a JSON object.  This script is automatically
 *  injected if you use the matching build and render utilities from `@adbl/unfinished-ssg`.
 *  Without this context, hydration cannot occur.
 *
 *  The `hydrate` function will automatically remove the `<script data-server-context>`
 *  tag after successfully restoring the context.
 *
 * @remarks
 * After hydration, the global `window` object will have a `hydrationcompleted` event dispatched.
 * This event can be listened to to confirm that hydration has completed successfully.
 * ```js
 *  window.addEventListener('hydrationcompleted', () => {
 *    console.log('Hydration complete!');
 *  });
 * ```
 *
 * @throws {Error} If the server context JSON script cannot be found in the DOM.
 * In this case, hydration will fail and a console error will be logged.
 */
export async function hydrate(routerFn) {
  const contextScript = document.querySelector('script[data-server-context]');
  if (!contextScript) {
    throw new Error(
      'hydration failed because the server context JSON script could not be found.'
    );
  }

  const context = JSON.parse(contextScript.textContent ?? '{}');
  const router = await restoreContext(context, routerFn);
  contextScript.remove();
  return router;
}

/**
 * Restores the server-side application context and re-initializes the client-side application.
 *
 * This function is a crucial step in the hydration process.  It takes the server-rendered
 * context (containing information about the application's state, root element, etc.) and
 * uses it to re-initialize the application's router and attach it to the existing HTML.
 *
 * @param {ServerContext} context - The server-rendered context, containing data about the application
 *  state, root element, and other consistent values.
 * @param {() => Router} routerCreateFn - The `createRouter` function used
 *  to create the application's router.
 */
async function restoreContext(context, routerCreateFn) {
  const { shell, path, rootSelector } = context;
  const vWindow = new VWindow();
  const webWindow = window;
  const observer = useObserver();

  recreateVWindow(shell, vWindow);
  setGlobalContext({
    mode: Modes.VDom,
    window: vWindow,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(Object.entries(context.consistentValues)),
  });

  const router = routerCreateFn();
  router.setWindow(vWindow);
  router.attachWindowListeners();

  const vAppRoot = vWindow.document.querySelector(rootSelector);
  if (!vAppRoot) throw new Error(`Root element "${rootSelector}" not found`);

  vAppRoot.append(/** @type {VNode} */ (router.Outlet()));
  await router.navigate(path);
  await vWindow.document.mountAllTeleports();

  const htmlRoot = webWindow.document.documentElement;
  const vHtmlRoot = vWindow.document.documentElement;

  hydrateDomNode(htmlRoot, vHtmlRoot)
    .then(() => {
      globalThis.window.dispatchEvent(new Event('hydrationcompleted'));
      observer.processMountedNodes();
    })
    .catch((error) => {
      console.error('Hydration error: ', error);
    });

  setGlobalContext({
    mode: Modes.Interactive,
    window,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(),
  });

  router.setWindow(window);
  router.attachWindowListeners();
  Reflect.set(globalThis.window.document, '__appRouterInstance', router);

  return router;
}

/**
 * Hydrates a single DOM node and its children with the associated virtual DOM node's data.
 *
 * This function recursively traverses the DOM, applying the necessary updates
 * to ensure that the real DOM matches the virtual DOM. This includes re-establishing
 * reactivity connections and porting various properties.
 *
 * @param {Node} node - The real DOM node to hydrate.
 * @param {VNode} vNode - The corresponding virtual DOM node.
 * @returns {Promise<void>} A promise that resolves when the node and its children have been hydrated.
 *
 * @remarks
 * This function is used internally by the `hydrate` function and is not intended for direct use.
 * It handles tasks such as:
 *
 * -   Setting attributes
 * -   Re-establishing event listeners
 * -   Setting ref values
 */
function hydrateDomNode(node, vNode) {
  return new Promise(() => {
    // Static nodes have been verified to contain no reactivity.
    // by the server, so we can skip hydration.
    if (node instanceof Element && node.hasAttribute('data-static')) return;

    // Propagate reactivity connections.
    const cellData = vNode.getRelatedCellData();
    if (cellData?.size) {
      const newSet = /** @type {typeof cellData} */ (new Set());
      for (const data of cellData) {
        if (!(data instanceof Function)) {
          newSet.add(data);
          continue;
        }
        if (!data.originalFunction || !data.relatedCell) continue;
        const reboundFn = /** @type {typeof data} */ (
          data.originalFunction.bind(node)
        );
        data.relatedCell.listen(reboundFn, { weak: true });
        newSet.add(reboundFn);
      }
      Reflect.set(node, '__attributeCells', newSet);
    }

    if (node instanceof Element && vNode instanceof VElement) {
      // Port hidden attributes: event listeners, etc.
      for (const [name, value] of vNode.hiddenAttributes) {
        setAttributeFromProps(/** @type {JsxElement} */ (node), name, value);
      }
      // Port ref values.
      const ref = Reflect.get(vNode, '__ref');
      if (ref instanceof SourceCell) {
        Reflect.set(node, '__ref', ref);
        ref.value = node;
      }
    }

    // Port range symbols.
    if (node instanceof Comment && vNode instanceof VComment) {
      const commentRangeSymbol = Reflect.get(vNode, '__commentRangeSymbol');
      if (commentRangeSymbol) {
        Reflect.set(node, '__commentRangeSymbol', commentRangeSymbol);
      }

      // Port ref values
      const ref = Reflect.get(vNode, '__ref');
      if (ref instanceof SourceCell) {
        Reflect.set(node, '__ref', ref);
        ref.value = node;
      }
    }

    // Todo: Hydrate Shadow roots.

    // Hydrate Children.
    let offset = 0;
    const textSplitNodes = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      const nodeChild = node.childNodes[i];
      const mirrorChild = vNode.childNodes[i - offset];
      if (!mirrorChild) continue;

      const isTextSplittingComment =
        nodeChild.nodeType === Node.COMMENT_NODE &&
        nodeChild.textContent === '@@' &&
        node.childNodes[i - 1]?.nodeType === Node.TEXT_NODE &&
        node.childNodes[i + 1]?.nodeType === Node.TEXT_NODE;

      if (isTextSplittingComment) {
        textSplitNodes.push(nodeChild);
        offset++;
      } else
        hydrateDomNode(nodeChild, mirrorChild).catch((error) => {
          console.error('Hydration error: ', error);
        });
    }

    // Dispatch final hydration callbacks. This will update
    // For loop caches and other listeners.
    vNode.dispatchEvent(new HydrationUpgradeEvent(node));

    for (const textSplitNode of textSplitNodes) textSplitNode.remove();
  });
}

/**
 * Recreates a virtual DOM structure from a serialized representation.
 *
 * This function takes a JSON-like object representing a virtual DOM node and
 * recursively reconstructs the corresponding `VNode` tree. This is essential
 * during the hydration process to create a virtual representation of the
 * server-rendered HTML.
 *
 * @param {Record<string, unknown>} obj - A serialized object representing a `VNode`.
 *   This object should contain properties such as `type`, `tag`, `attrs`, and `nodes`
 *   that describe the structure and attributes of the virtual DOM node.
 * @param {VWindow} window - The `VWindow` instance to which the recreated `VNode`
 *   will be attached.  This is the virtual window that will contain the
 *   recreated virtual DOM.
 * @returns {VNode} The recreated `VNode` (virtual DOM node).
 */
function recreateVWindow(obj, window) {
  const { document } = window;
  if (obj.type === 1) {
    // Element node
    const element = document.createElement(/** @type {string} */ (obj.tag));
    if (obj.tag === 'HTML') window.document.documentElement = element;
    if (obj.tag === 'HEAD') window.document.head = element;
    if (obj.tag === 'BODY') window.document.body = element;

    if (obj.attrs) {
      for (const [name, value] of Object.entries(obj.attrs)) {
        element.setAttribute(name, value);
      }
    }

    if (obj.nodes) {
      const childNodes = /** @type {Array<Record<string, unknown>>} */ (
        obj.nodes
      );
      for (const childObj of childNodes) {
        element.append(recreateVWindow(childObj, window));
      }
    }

    return element;
  }
  if (obj.type === 8)
    return document.createComment(/** @type {string} */ (obj.text));
  return document.createTextNode(/** @type {string} */ (obj.text));
}

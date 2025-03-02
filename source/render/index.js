import { getGlobalContext, matchContext, Modes } from '../library/context.js';
import {
  ArgumentList,
  generateChildNodes,
  isDevMode,
} from '../library/utils.js';
import { routeToComponent } from '../router/routeTree.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as VDom from '../v-dom/index.js' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as Context from '../library/context.js' */

/** @typedef {{ __nextInstance?: (...args: any[]) => JSX.Template }} UpdatableFn */
/** @typedef {Node & { __commentRangeSymbol?: symbol }} RangedNode */

/**
 * @typedef Instance
 *
 * @property {Record<string, unknown>} [props]
 * Props passed to the component instance.
 *
 * @property {RangedNode[]} nodes
 * Nodes returned from the component instance.
 */

/**
 * @typedef {(Node | VDom.VNode) & {
 *  __linked?: boolean,
 *  __promise?: Promise<Node[]>
 * }} LinkableNodeLike
 */

/**
 * @typedef {Node & {
 *  __linked?: boolean,
 *  __promise?: Promise<Node[]>
 * }} LinkableNode
 */

/**
 * @typedef {Object} HMRFunctionOptions
 */

/**
 * @type {MutationObserver | undefined}
 * Responsible for observing DOM mutations and dropping component instances
 * that are no longer in the DOM.
 */
let hmrObserver;

/**
 * Links a set of DOM nodes to (ideally) its parent
 * factory function.
 *
 * It only works in development mode and is a noop in environments
 * that don't support `import.meta.hot`.
 *
 * @param {LinkableNodeLike[]} resultNodes The nodes to link.
 * @param {Function} factory The factory function of the component.
 * @param {any} [props] Props that were used to create the component.
 */
export function linkNodesToComponent(resultNodes, factory, props) {
  if (!isDevMode) return;
  const nodes = /** @type {LinkableNode[]} */ (resultNodes);
  const { window } = getGlobalContext();
  if (matchContext(window, Modes.VDom)) return;

  /// @ts-ignore: The Vite types are not installed.
  if (!import.meta.hot) return;

  /** @type {Map<Function, Set<Instance>>} */
  const jsxFunctions =
    // @ts-ignore: The Vite types are not installed.
    import.meta.hot.data.jsxFunctionInstances ?? new Map();
  const instanceList = jsxFunctions.get(factory) ?? new Set();

  /** @type {Instance} */
  const newInstance = {
    props,
    nodes: [],
  };

  for (const node of nodes) {
    if (!(node instanceof window.Node)) continue;
    // A node can only be linked to at most one parent function.
    if (node.__linked) continue;
    // In case of a promise, we need to link to the resolved nodes.
    if (node.__promise) {
      const promise = node.__promise;
      promise.then((nodes) => {
        newInstance.nodes.push(
          .../** @type {Node[]} **/ (generateChildNodes(nodes))
        );
      });
      continue;
    }
    newInstance.nodes.push(node);
  }

  instanceList.add(newInstance);
  jsxFunctions.set(factory, instanceList);

  /// @ts-ignore: The Vite types are not installed.
  import.meta.hot.data.jsxFunctionInstances = jsxFunctions;
}

/**
 * Hot reload handler for JSX components, updating only changed functions within a module.
 * Compares instances of JSX function components between the old and new modules to selectively
 * re-render only those that have changed. This approach avoids unnecessary re-renders and
 * optimizes hot module replacement (HMR) for JSX files.
 *
 * @param {Object} newModule - The updated module with potentially changed function components.
 * @param {string} url - The module's URL, used to dynamically import and compare the old module.
 */
export const hotReloadModule = async (newModule, url) => {
  if (!hmrObserver) {
    hmrObserver = new MutationObserver(() => {
      /** @type {Map<Function, Set<Instance>>} */
      const jsxFunctions =
        // @ts-ignore: The Vite types are not installed.
        import.meta.hot.data.jsxFunctionInstances ?? new Map();

      for (const [func, instanceList] of jsxFunctions) {
        for (const instance of instanceList) {
          // This may not be true in all cases, but for now
          // a component instance is considered connected
          // if its first node is connected to the DOM.
          if (!instance.nodes[0]?.isConnected) {
            instanceList.delete(instance);
          }
        }
        if (instanceList.size === 0) {
          jsxFunctions.delete(func);
        }
      }
    });
    hmrObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (!newModule) return;

  // Dynamically import the old module using its URL.
  const oldModule = await import(/* @vite-ignore */ url);

  const newModuleData = Object.entries(newModule);
  if (newModuleData.length === 0) {
    globalThis.window?.location?.reload?.();
    return;
  }

  for (const [key, newInstance] of newModuleData) {
    const oldInstance = oldModule[key];
    if (!oldInstance) continue;
    if (typeof oldInstance !== 'function') continue;
    if (typeof newInstance !== 'function') continue;

    // If the function is a routing component, then it needs to swapped out
    // in the route tree.
    if (routeToComponent.has(oldInstance)) {
      const matches = routeToComponent.get(oldInstance);
      if (matches) {
        for (const match of matches) {
          match.component = newInstance;
        }
        routeToComponent.set(newInstance, matches);
      }
      routeToComponent.delete(oldInstance);
    }

    // If the function is a routing component (a function that renders into a router outlet),
    // keep-alive cache needs to be invalidated, or it will override the new HMR render
    // when the route is visited again.
    if (oldInstance.__routeLevelFunction) {
      const path = oldInstance.__renderedPath;
      oldInstance.__renderedOutlet?.deref()?.__keepAliveCache?.delete(path);
      newInstance.__routeLevelFunction = true;
      newInstance.__routeRenders = oldInstance.__routeRenders;
      newInstance.__renderedPath = oldInstance.__renderedPath;
    }

    /** @type {Map<Function, Set<Instance>> | undefined} */
    const jsxFunctionInstances =
      // @ts-ignore: Ignore TypeScript errors due to missing Vite types.
      import.meta.hot?.data?.jsxFunctionInstances;

    if (!jsxFunctionInstances) {
      globalThis.window?.location?.reload?.();
      return;
    }
    const componentInstances = jsxFunctionInstances.get?.(oldInstance);

    // Skip functions with no active JSX instances to re-render.
    if (!componentInstances) {
      return;
    }

    jsxFunctionInstances.delete(oldInstance);
    oldInstance.__nextInstance = newInstance;

    for (const instance of componentInstances) {
      // if the node is not in the DOM, skip re-rendering.
      if (!instance.nodes[0]?.isConnected) {
        const liveNodes = instance.nodes;
        linkNodesToComponent(liveNodes, newInstance, instance.props);
        continue;
      }

      try {
        // Generate new child nodes for the updated component instance.
        const newComponentCall =
          instance.props && instance.props instanceof ArgumentList
            ? newInstance(...instance.props.data)
            : newInstance(instance.props);
        const newNodes = /** @type {Node[]} */ (
          generateChildNodes(newComponentCall)
        );

        const fragment = document.createDocumentFragment();
        fragment.append(...newNodes);

        // only the first node rendered is important.
        // ideally components should only render one
        // top level node.
        const anchor = instance.nodes[0];
        for (const node of instance.nodes) {
          if (node === anchor) continue;
          // If the node is a connect comment, all the nodes
          // between it and the next comment with the same id
          // will be removed. This is used in cleaning up
          // Switch, For and If components.
          if (node.__commentRangeSymbol) {
            const id = node.__commentRangeSymbol;
            while (true) {
              const nextNode = /** @type {RangedNode} */ (node.nextSibling);
              if (!nextNode || nextNode.__commentRangeSymbol === id) break;
              nextNode.parentElement?.removeChild(nextNode);
            }
          }
          node.parentElement?.removeChild(node);
        }

        if (anchor) {
          // Replace the old anchor node with the new DOM fragment.
          anchor.parentNode?.replaceChild(fragment, anchor);
          if (anchor.__commentRangeSymbol) {
            const id = anchor.__commentRangeSymbol;
            while (true) {
              const nextNode = /** @type {RangedNode} */ (anchor.nextSibling);
              if (!nextNode || nextNode.__commentRangeSymbol === id) break;
              nextNode.parentElement?.removeChild(nextNode);
            }
          }
        }

        linkNodesToComponent(newNodes, newInstance, instance.props);
      } catch (error) {
        console.error(error);
        // Fallback to old nodes if new nodes fail to render.
        const liveNodes = instance.nodes;
        linkNodesToComponent(liveNodes, newInstance, instance.props);
      }
    }
  }
};

/**
 * A Vite plugin to enable hot module replacement (HMR) for JSX and TSX files
 * in the Vite build environment. This plugin specifically targets files with
 * `.jsx` or `.tsx` extensions, excluding files in the `node_modules` directory.
 * It injects code to handle HMR by calling a custom hot reload handler function
 * from the '@adbl/unfinished/render' package.
 *
 * @returns A Vite plugin object with a `name` property and `transform` hook.
 */
export const hmrPlugin = () => {
  return {
    name: 'vite-unfinished-hmr',

    /**
     * Transforms the given module code by injecting HMR handling for `.jsx` and
     * `.tsx` files, enabling automatic updates during development. Excludes modules
     * in `node_modules`.
     *
     * @param {string} code - The source code of the module being transformed.
     * @param {string} id - The unique identifier (path) of the module.
     * @returns {{code: string, map: null} | null} An object with the transformed code
     * and a null source map, or `null` if the module should not be transformed.
     */
    transform(code, id) {
      if (id.includes('node_modules')) {
        return null;
      }

      const isJsx = id.endsWith('.jsx') || id.endsWith('.tsx');

      if (!isJsx) return null;

      const injectedCode = `
import { hotReloadModule as __HMR__ } from '@adbl/unfinished/render';

${code}

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    __HMR__(newModule, import.meta.url);
  });
}
      `;

      return {
        code: injectedCode,
        map: null,
      };
    },
  };
};

const voidElements = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);

const SPLIT_TEXT_MARKER = '<!--@@-->';

/**
 * @typedef {Object} RenderToStringOptions
 * @property {boolean} [markStaticNodes]
 * Whether to mark static elements with the [data-static] attribute.
 */

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Context.WindowLike} window - The window object.
 * @param {RenderToStringOptions} [options] - Options for rendering the template.
 * @returns {Promise<string>} A promise that resolves to the rendered string.
 *
 * @description
 * This function takes a JSX template and converts it to its string representation.
 * It can handle various types of input, including primitive values, Promises,
 * DOM nodes, and arrays of templates.
 *
 * @example
 * const jsxTemplate = <div>Hello, world!</div>;
 * const renderedString = await renderToString(jsxTemplate);
 * console.log(renderedString); // Outputs: <div>Hello, world!</div>
 */
export async function renderToString(template, window, options = {}) {
  if (/string|number|boolean/.test(typeof template)) {
    return String(template);
  }

  if (template instanceof Promise) {
    return await renderToString(await template, window, options);
  }

  if (template instanceof window.DocumentFragment) {
    let textContent = '';
    for (const child of template.childNodes) {
      textContent += await renderToString(child, window, options);
    }
    return textContent;
  }

  if (
    'MarkupContainerNode' in window &&
    template instanceof window.MarkupContainerNode
  ) {
    return template.html;
  }

  if (
    template instanceof window.Comment &&
    '__promise' in template &&
    template.__promise instanceof Promise
  ) {
    return await renderToString(await template.__promise, window, options);
  }

  if (template instanceof window.Node) {
    /*
     * TODO: There is a bug in happy-dom where
     * template instanceof window.Text is always false,
     * even when the nodeType is Node.TEXT_NODE
     */
    if (template.nodeType === window.Node.TEXT_NODE) {
      return template.textContent ?? '';
    }

    if (template.nodeType === window.Node.COMMENT_NODE) {
      return `<!--${template.textContent}-->`;
    }

    if (template instanceof window.ShadowRoot) {
      let text = `<template shadowrootmode="${template.mode}">`;
      for (const child of template.childNodes) {
        text += await renderToString(child, window, options);
      }
      text += '</template>';
      return text;
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();

      let text = `<${tagName}`;

      for (const attribute of template.attributes) {
        text += ` ${attribute.name}="${attribute.value}"`;
      }

      if (options.markStaticNodes) {
        const isStatic = nodeIsStatic(/** @type {*} */ (template), window);
        if (isStatic) {
          // @ts-ignore
          template.__isStatic = true;
          // @ts-ignore
          if (!template.parentNode?.__isStatic) {
            text += ' data-static';
          }
        }
      }

      const isVoid = voidElements.has(template.tagName);
      if (!isVoid || template.childNodes.length > 0 || template.shadowRoot) {
        text += '>';

        if (template.shadowRoot) {
          text += await renderToString(template.shadowRoot, window, options);
        }

        let precededByTextNode = false;
        for (const child of template.childNodes) {
          // Insert marker between consecutive text nodes to preserve whitespace
          // This prevents text node merging during HTML parsing
          const shouldSplit =
            precededByTextNode &&
            child.nodeType === window.Node.TEXT_NODE &&
            Boolean(child.textContent?.trim());

          if (shouldSplit) {
            text += `${SPLIT_TEXT_MARKER}${await renderToString(
              child,
              window,
              options
            )}`;
          } else {
            text += await renderToString(child, window, options);
          }
          precededByTextNode =
            child.nodeType === window.Node.TEXT_NODE &&
            Boolean(child.textContent?.trim());
        }

        text += `</${tagName}>`;
      } else {
        text += '/>';
      }

      return text;
    }

    if (template instanceof window.Document) {
      return await renderToString(template.documentElement, window, options);
    }
  }

  if (Array.isArray(template)) {
    let textContent = '';
    for (const child of template) {
      textContent += await renderToString(child, window, options);
    }
    return textContent;
  }

  return '';
}

/**
 * Checks if a node has no reactivity attached so it can be marked as static.
 * Static node can be safely skipped during hydration.
 * @param {Context.NodeLike & {
 *  __isHydrationUpgradable?: boolean,
 *  __ref?: any,
 *  __attributeCells?: Map<string, any>,
 *  hiddenAttributes?: Map<string, any>,
 *  getAttribute: (name: string) => string | null,
 *  childNodes: any[],
 *  __commentRangeSymbol?: any
 * }} node
 * @param {Context.WindowLike} window
 */
function nodeIsStatic(node, window) {
  if (node.__commentRangeSymbol) return false;
  if (node.__attributeCells?.size) return false;

  if (node.nodeType === window.Node.ELEMENT_NODE) {
    if (node.getAttribute('data-static') !== null) return true;
    if (node.__ref) return false;
    if (node.hiddenAttributes?.size) return false;

    for (const child of node.childNodes) {
      if (!nodeIsStatic(child, window)) return false;
    }
  }

  return true;
}

import { getGlobalContext, matchContext, Modes } from '../context/index.js';
import {
  ArgumentList,
  generateChildNodes,
  isDevMode,
} from '../library/utils.js';
import { routeToComponent } from '../router/routeTree.js';

/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import * as VDom from '../v-dom/index.js' */

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
  if (import.meta.env.SSR) return; // Skip HMR on the server
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

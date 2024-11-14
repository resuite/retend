import { generateChildNodes, isDevMode } from '../library/utils.js';
import { routeToComponent } from '../router/routeTree.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * @typedef Instance
 *
 * @property {Record<string, unknown>} [props]
 * Props passed to the component instance.
 *
 * @property {Node[]} nodes
 * Nodes returned from the component instance.
 */

/** @type {WeakMap<Function, Instance[]>} */
export const jsxFunctionInstances = new WeakMap();

/** @typedef {Node & { __linked?: boolean, __promise?: Promise<Node[]> }} LinkableNode */

/**
 * @typedef {Object} HMRFunctionOptions
 *
 * @property {number} [maxInstanceCount]
 * The maximum number of instances of the component that can be linked to the render function.
 */

/**
 * Links a set of DOM nodes to (ideally) its parent
 * factory function.
 *
 * It only works in development mode.
 * @param {LinkableNode[]} nodes The nodes to link.
 * @param {Function & {__hmrSymbol?: symbol}} factory The factory function of the component.
 * @param {any} [props] Props that were used to create the component.
 * @param {HMRFunctionOptions} [options]
 */
export function linkNodesToComponent(nodes, factory, props, options) {
  if (!isDevMode) return;

  let jsxFunctions = jsxFunctionInstances;
  // @ts-ignore: The Vite types are not installed.
  if (import.meta.hot) {
    // @ts-ignore: The Vite types are not installed.
    jsxFunctions = import.meta.hot.data.jsxFunctionInstances ?? new WeakMap();
  }
  const instanceList = jsxFunctions.get(factory) ?? [];

  /** @type {Instance} */
  const newInstance = {
    props,
    nodes: [],
  };

  for (const node of nodes) {
    if (!(node instanceof globalThis.window.Node)) continue;
    // A node can only be linked to at most one parent function.
    if (node.__linked) continue;
    // In case of a promise, we need to link to the resolved nodes.
    if (node.__promise) {
      const promise = node.__promise;
      promise.then((nodes) => {
        newInstance.nodes.push(...nodes);
      });
      continue;
    }
    newInstance.nodes.push(node);
  }

  if (options?.maxInstanceCount) {
    instanceList.length = options.maxInstanceCount - 1;
  }

  instanceList.push(newInstance);
  jsxFunctions.set(factory, instanceList);

  // @ts-ignore: The Vite types are not installed.
  if (import.meta.hot) {
    // @ts-ignore: The Vite types are not installed.
    import.meta.hot.data.jsxFunctionInstances = jsxFunctions;
  }
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
  if (!newModule) {
    return;
  }

  // Dynamically import the old module using its URL.
  const oldModule = await import(/* @vite-ignore */ url);

  // Convert new module properties into an iterable array.
  const moduleData = Object.entries(newModule);
  if (moduleData.length === 0) {
    // globalThis.window?.location?.reload?.();
    return;
  }

  for (const [key, newInstance] of moduleData) {
    const oldInstance = oldModule[key];
    if (!oldInstance) {
      continue;
    }

    // Ensure both old and new instances are functions before proceeding.
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
      /** @type {Array<import('../router/index.js').RouteRender>} */
      const routeRenders = oldInstance.__routeRenders;
      if (routeRenders)
        for (const routeRender of routeRenders) {
          routeRender.outlet.__keepAliveCache?.delete(routeRender.path);
        }
      newInstance.__routeLevelFunction = true;
      newInstance.__routeRenders = oldInstance.__routeRenders;
    }

    /** @type {WeakMap<Function, Instance[]>} */
    const jsxFunctionInstances =
      // @ts-ignore: Ignore TypeScript errors due to missing Vite types.
      import.meta.hot?.data?.jsxFunctionInstances ?? new WeakMap();
    const componentInstances = jsxFunctionInstances?.get?.(oldInstance);

    // Skip functions with no active JSX instances to re-render.
    if (!componentInstances) {
      globalThis.window?.location?.reload?.();
      return;
    }

    // Invalidate the old instance by removing it from the map.
    jsxFunctionInstances.delete(oldInstance);

    for (const instance of componentInstances) {
      // if the node is not in the DOM, skip re-rendering.
      if (!instance.nodes[0]?.isConnected) {
        linkNodesToComponent(instance.nodes, newInstance, instance.props);
        continue;
      }

      try {
        // Generate new child nodes for the updated component instance.
        const newNodes = generateChildNodes(newInstance(instance.props));

        const fragment = document.createDocumentFragment();
        fragment.append(...newNodes);

        // Handle DOM replacement to update the component's rendered nodes.
        const anchorNode = instance.nodes[0];
        for (const node of instance.nodes) {
          if (node === anchorNode) {
            continue;
          }
          node.parentElement?.removeChild(node);
        }

        // Replace the old anchor node with the new DOM fragment.
        anchorNode.parentNode?.replaceChild(fragment, anchorNode);

        // Re-link the new nodes to the component instance, preserving props.
        linkNodesToComponent(newNodes, newInstance, instance.props);
      } catch (error) {
        console.error(error);
        // Fallback to old instance if new instance fails to render.
        linkNodesToComponent(instance.nodes, oldInstance, instance.props);
      }
    }
  }
};

/**
 * A Vite plugin to enable hot module replacement (HMR) for JSX and TSX files
 * in the Vite build environment. This plugin specifically targets files with
 * `.jsx` or `.tsx` extensions, excluding files in the `node_modules` directory.
 * It injects code to handle HMR by calling a custom hot reload handler function
 * from the '@adbl/dom/render' package.
 *
 * @returns A Vite plugin object with a `name` property and `transform` hook.
 */
export const hmrPlugin = () => {
  return {
    name: 'vite-dom-jsx',

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

      if (!isJsx) {
        return null;
      }

      const injectedCode = `
import { hotReloadModule as __HMR__ } from '@adbl/dom/render';

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

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & typeof globalThis} window - The window object.
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
export async function renderToString(template, window) {
  if (
    typeof template === 'string' ||
    typeof template === 'number' ||
    typeof template === 'boolean'
  ) {
    return String(template);
  }

  if (template instanceof Promise) {
    return await renderToString(await template, window);
  }

  if (template instanceof window.DocumentFragment) {
    let textContent = '';
    for (const child of Array.from(template.childNodes)) {
      textContent += await renderToString(child, window);
    }
    return textContent;
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

    if (template instanceof window.Element) {
      let text = `<${template.tagName.toLowerCase()}`;

      for (const attribute of Array.from(template.attributes)) {
        text += ` ${attribute.name}="${attribute.value}"`;
      }

      text += '>';

      for (const child of Array.from(template.childNodes)) {
        text += await renderToString(child, window);
      }

      text += `</${template.tagName.toLowerCase()}>`;

      return text;
    }

    if (template instanceof window.Document) {
      return await renderToString(template.documentElement, window);
    }
  }

  if (Array.isArray(template)) {
    let textContent = '';
    for (const child of template) {
      textContent += await renderToString(child, window);
    }
    return textContent;
  }

  return '';
}

/**
 * @typedef RouteRenderResult
 * @property {string} content - The rendered HTML content.
 * @property {string} path - The path rendered.
 * @property {string} title - The title of the rendered page.
 */

/**
 * Renders a route to a string representation.
 *
 * @param {import('../router/index.js').Router} router - The router instance.
 * @param {string} path - The path to navigate to.
 * @param {Window & typeof globalThis} window - The window object.
 * @returns {Promise<RouteRenderResult>} The rendered HTML string.
 */
export async function renderRoute(router, path, window) {
  router.window = window;
  const outlet = router.Outlet();

  const app = document.createElement('div');
  app.id = 'app';
  document.body.prepend(app);

  app.appendChild(outlet);
  router.attachWindowListeners();

  await router.navigate(path);

  return {
    content: await renderToString(app, window),
    title: window.document.title,
    path: window.location.pathname,
  };
}

/**
 *
 * @param {Element} app
 * @param {JSX.Template} clientContent
 * @param {Window & typeof globalThis} window
 */
export async function render(app, clientContent, window) {
  const nodes = generateChildNodes(clientContent);
  if (!app.firstChild) {
    // If there is no prior content, it simply appends and moves on.
    app.append(...nodes);
    return app;
  }

  const fragment = window.document.createDocumentFragment();
  fragment.append(...nodes);

  /*** @type {ChildNode | null} */
  let currentStaticNode = app.firstChild;
  let currentAppNode = fragment.firstChild;

  const finalFragment = window.document.createDocumentFragment();
  while (currentStaticNode || currentAppNode) {
    await mergeNodes(currentStaticNode, currentAppNode, finalFragment, window);

    currentAppNode = currentAppNode?.nextSibling ?? null;
    currentStaticNode = currentStaticNode?.nextSibling ?? null;
  }

  app.replaceChildren(finalFragment);
  return app;
}

/**
 * @param {Node | null} staticNode
 * @param {Node | null} appNode
 * @param {DocumentFragment} resultFragment;
 * @param {Window & typeof globalThis} window
 */
async function mergeNodes(staticNode, appNode, resultFragment, window) {
  if (!staticNode && appNode) {
    showHydrationWarning({
      expected: await renderToString(appNode, window),
      got: null,
    });
    resultFragment.appendChild(appNode);
    return;
  }

  if (!appNode && staticNode) {
    showHydrationWarning({
      expected: null,
      got: await renderToString(staticNode, window),
    });
    resultFragment.appendChild(staticNode);
    return;
  }

  if (!appNode || !staticNode) {
    return;
  }

  if (appNode.nodeType !== staticNode.nodeType) {
    showHydrationWarning({
      expected: await renderToString(appNode, window),
      got: null,
    });
  }

  resultFragment.appendChild(appNode);
}

/**
 *
 * @param {{expected: string | null, got: string | null}} _options
 */
function showHydrationWarning(_options) {}

import {
  type JsxElement,
  Modes,
  setAttributeFromProps,
  setGlobalContext,
  useObserver,
} from '@adbl/unfinished';
import {
  HydrationUpgradeEvent,
  VComment,
  VElement,
  type VNode,
  VWindow,
} from '@adbl/unfinished/v-dom';
import { SourceCell } from '@adbl/cells';
import type { RouterModule, ServerContext } from './types.ts';

export async function hydrate(routerModule: RouterModule) {
  const contextScript = document.querySelector('script[data-server-context]');
  if (contextScript) {
    const context = JSON.parse(contextScript.textContent ?? '{}');
    await restoreContext(context, routerModule);
    contextScript.remove();
  }
}

export async function restoreContext(
  context: ServerContext,
  routerModule: RouterModule
) {
  const { shell, path, rootSelector } = context;
  const { createRouter } = routerModule;
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

  const router = createRouter();
  router.setWindow(vWindow);
  router.attachWindowListeners();

  const vAppRoot = vWindow.document.querySelector(rootSelector);
  if (!vAppRoot) throw new Error(`Root element "${rootSelector}" not found`);

  vAppRoot.append(router.Outlet() as VNode);
  await router.navigate(path);
  await vWindow.document.mountAllTeleports();

  const htmlRoot = webWindow.document.documentElement;
  const vHtmlRoot = vWindow.document.documentElement;

  hydrateDomNode(htmlRoot, vHtmlRoot)
    .then(() => {
      console.log('[unfinished-ssr] hydration completed.');
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

function hydrateDomNode(node: Node, vNode: VNode) {
  return new Promise<void>(() => {
    // Static nodes have been verified to contain no reactivity.
    // by the server, so we can skip hydration.
    if (node instanceof Element && node.hasAttribute('data-static')) return;

    // Propagate reactivity connections.
    const cellData = vNode.getRelatedCellData();
    if (cellData?.size) {
      const newSet: typeof cellData = new Set();
      for (const data of cellData) {
        if (!(data instanceof Function)) {
          newSet.add(data);
          continue;
        }
        if (!data.originalFunction || !data.relatedCell) continue;
        const reboundFn = data.originalFunction.bind(node) as typeof data;
        data.relatedCell.listen(reboundFn, { weak: true });
        newSet.add(reboundFn);
      }
      Reflect.set(node, '__attributeCells', newSet);
    }

    if (node instanceof Element && vNode instanceof VElement) {
      // Port hidden attributes: event listeners, etc.
      for (const [name, value] of vNode.hiddenAttributes) {
        setAttributeFromProps(node as JsxElement, name, value);
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

function recreateVWindow(obj: Record<string, unknown>, window: VWindow): VNode {
  const { document } = window;
  if (obj.type === 1) {
    // Element node
    const element = document.createElement(obj.tag as string);
    if (obj.tag === 'HTML') window.document.documentElement = element;
    if (obj.tag === 'HEAD') window.document.head = element;
    if (obj.tag === 'BODY') window.document.body = element;

    if (obj.attrs) {
      const attrs = obj.attrs as Record<string, string>;
      for (const [name, value] of Object.entries(attrs)) {
        element.setAttribute(name, value);
      }
    }

    if (obj.nodes) {
      const childNodes = obj.nodes as Array<Record<string, unknown>>;
      for (const childObj of childNodes) {
        element.append(recreateVWindow(childObj, window));
      }
    }

    return element;
  }
  if (obj.type === 8) return document.createComment(obj.text as string);
  return document.createTextNode(obj.text as string);
}

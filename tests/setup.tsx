import { beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import {
  Modes,
  setGlobalContext,
  resetGlobalContext,
  getGlobalContext,
  type NodeLike,
  isVNode,
} from 'retend/context';
import { VWindow } from 'retend/v-dom';
import { Outlet, type Router, RouterProvider } from 'retend/router';
import { setActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';

export const timeout = async (number?: number) => {
  return new Promise((r) => setTimeout(r, number ?? 0));
};

export const routerRoot = (router: Router): string & Node => {
  // @ts-expect-error
  return <RouterProvider router={router}>{() => <Outlet />}</RouterProvider>;
};

export const routerSetup = () => {
  const window = new VWindow();
  setGlobalContext({
    mode: Modes.VDom,
    window,
    consistentValues: new Map(),
    globalData: new Map(),
    teleportIdCounter: { value: 0 },
  });
  setActiveRenderer(new DOMRenderer(window));
};

export const routerSetupBrowser = () => {
  const { document } = window;

  beforeEach(async () => {
    clearBrowserWindow();
    document.body.append(document.createElement('retend-router-outlet'));

    setGlobalContext({
      mode: Modes.Interactive,
      window: window,
      consistentValues: new Map(),
      globalData: new Map(),
      teleportIdCounter: { value: 0 },
    });
    setActiveRenderer(new DOMRenderer(window));
  });

  afterEach(() => {
    resetGlobalContext();
  });
};

export const clearBrowserWindow = () => {
  window.document.body.innerHTML = '';
  window.history.go(-window.history.length);
  window.sessionStorage.clear();
  window.localStorage.clear();
};

export const browserSetup = () => {
  beforeEach(() => {
    clearBrowserWindow();

    setGlobalContext({
      window,
      mode: Modes.Interactive,
      teleportIdCounter: { value: 0 },
      consistentValues: new Map(),
      globalData: new Map(),
    });
    setActiveRenderer(new DOMRenderer(window));
  });

  afterEach(() => {
    resetGlobalContext();
    clearBrowserWindow();
  });
};

export const vDomSetup = () => {
  beforeEach(() => {
    const window = new VWindow();
    setGlobalContext({
      window,
      consistentValues: new Map(),
      globalData: new Map(),
      mode: Modes.VDom,
      teleportIdCounter: { value: 0 },
    });
    setActiveRenderer(new DOMRenderer(window));
  });

  afterEach(() => {
    resetGlobalContext();
  });
};

export const getTextContent = (element: NodeLike) => {
  const { window } = getGlobalContext();

  if (!isVNode(element)) {
    return element.textContent;
  }

  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === window.Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node instanceof window.Element) {
      text += getTextContent(node);
    }
  }

  return text;
};

import 'retend-web/jsx-runtime';
import type { JSX } from 'retend/jsx-runtime';

import { setActiveRenderer, getActiveRenderer } from 'retend';
import { type VNode, VWindow, isVNode } from 'retend-server/v-dom';
import { VDOMRenderer } from 'retend-server/v-dom';
import { DOMRenderer } from 'retend-web';
import { setGlobalContext, resetGlobalContext } from 'retend/context';
import { beforeEach, afterEach } from 'vitest';

export type NodeLike = VNode | Node;

export const timeout = async (number?: number) => {
  return new Promise((r) => setTimeout(r, number ?? 0));
};

export const render = (node: JSX.Template) =>
  getActiveRenderer().render(node) as unknown as Element;

export const routerSetup = () => {
  const window = new VWindow();
  setGlobalContext({
    globalData: new Map(),
    teleportIdCounter: { value: 0 },
  });
  setActiveRenderer(new VDOMRenderer(window));
};

export const routerSetupBrowser = () => {
  const { document } = window;

  beforeEach(async () => {
    clearBrowserWindow();
    document.body.append(document.createElement('retend-router-outlet'));

    setGlobalContext({
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
      teleportIdCounter: { value: 0 },
      globalData: new Map(),
    });
    setActiveRenderer(new DOMRenderer(window));
  });

  afterEach(() => {
    resetGlobalContext();
    clearBrowserWindow();
  });
};

export const vDomSetup = (options?: { markDynamicNodes: boolean }) => {
  beforeEach(() => {
    const window = new VWindow();
    setGlobalContext({
      globalData: new Map(),
      teleportIdCounter: { value: 0 },
    });
    setActiveRenderer(new VDOMRenderer(window, options));
  });

  afterEach(() => {
    resetGlobalContext();
  });
};

export const getTextContent = (element: Node | VNode) => {
  const renderer = getActiveRenderer() as DOMRenderer;
  const { host: window } = renderer;

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

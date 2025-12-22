import 'retend-web/jsx-runtime';
import { beforeEach, afterEach } from 'vitest';
import { setGlobalContext, resetGlobalContext } from 'retend/context';
import { type VNode, VWindow, isVNode } from 'retend-server/v-dom';
import { setActiveRenderer, getActiveRenderer } from 'retend';

import { DOMRenderer } from 'retend-web';
import { VDOMRenderer } from 'retend-server/v-dom';

export type NodeLike = VNode | Node;

export const timeout = async (number?: number) => {
  return new Promise((r) => setTimeout(r, number ?? 0));
};

export const routerSetup = () => {
  const window = new VWindow();
  setGlobalContext({
    consistentValues: new Map(),
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
      consistentValues: new Map(),
      globalData: new Map(),
      teleportIdCounter: { value: 0 },
    });
    setActiveRenderer(new VDOMRenderer(window));
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

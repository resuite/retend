import { beforeEach, beforeAll, afterAll } from 'vitest';
import {
  Modes,
  setGlobalContext,
  resetGlobalContext,
  getGlobalContext,
  type NodeLike,
  isVNode,
} from 'retent/context';
import { VWindow } from 'retent/v-dom';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

export const routerSetup = () => {
  const window = new VWindow();
  window.document.body.append(
    window.document.createElement('retent-router-outlet')
  );

  setGlobalContext({
    mode: Modes.VDom,
    window,
    consistentValues: new Map(),
    teleportIdCounter: { value: 0 },
  });
};

export const browserSetup = () => {
  beforeAll(() => {
    GlobalRegistrator.register();
  });

  beforeEach(() => {
    setGlobalContext({
      window,
      mode: Modes.Interactive,
      teleportIdCounter: { value: 0 },
      consistentValues: new Map(),
    });
  });

  afterAll(() => {
    GlobalRegistrator.unregister();
    resetGlobalContext();
  });
};

export const vDomSetup = () => {
  beforeEach(() => {
    setGlobalContext({
      window: new VWindow(),
      consistentValues: new Map(),
      mode: Modes.VDom,
      teleportIdCounter: { value: 0 },
    });
  });

  afterAll(() => {
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

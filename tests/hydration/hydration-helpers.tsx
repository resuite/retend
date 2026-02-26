import {
  Await,
  branchState,
  setActiveRenderer,
  waitForAsyncBoundaries,
  withState,
} from 'retend';
import { setGlobalContext } from 'retend/context';
import type { JSX } from 'retend/jsx-runtime';
import { renderToString } from 'retend-server/client';
import { VDOMRenderer, type VNode, VWindow } from 'retend-server/v-dom';
import { DOMRenderer } from 'retend-web';
import { vi } from 'vitest';

type TemplateFn = () => JSX.Template;

const resetHydrationContext = () => {
  setGlobalContext({
    globalData: new Map(),
    teleportIdCounter: { value: 0 },
  });
};

async function maybeWithRealTimers<T>(
  shouldUseRealTimers: boolean,
  callback: () => Promise<T>
) {
  const shouldRestoreFakeTimers = shouldUseRealTimers && vi.isFakeTimers();
  if (shouldRestoreFakeTimers) vi.useRealTimers();
  try {
    return await callback();
  } finally {
    if (shouldRestoreFakeTimers) vi.useFakeTimers();
  }
}

export const renderHydrationServerHtml = async (
  templateFn: TemplateFn,
  isAsync = false
) => {
  return maybeWithRealTimers(isAsync, async () => {
    resetHydrationContext();
    const serverWindow = new VWindow();
    const serverRenderer = new VDOMRenderer(serverWindow, {
      markDynamicNodes: true,
    });
    setActiveRenderer(serverRenderer);
    const serverTemplate = isAsync
      ? () =>
          Await({
            fallback: null,
            children: templateFn,
          })
      : templateFn;
    const serverRoot = serverRenderer.render(serverTemplate) as VNode | VNode[];
    const nodes = Array.isArray(serverRoot) ? serverRoot : [serverRoot];
    serverWindow.document.body.append(...nodes);
    if (isAsync) {
      await waitForAsyncBoundaries();
    }
    await serverWindow.document.mountAllTeleports();
    return renderToString(serverWindow.document.body, serverWindow);
  });
};

export const createHydrationClientRenderer = (html: string) => {
  const shell = `<div id="app">${html}</div>`;
  window.document.body.setHTMLUnsafe(shell);
  resetHydrationContext();
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);
  renderer.enableHydrationMode();
  const root = window.document.querySelector('#app') as HTMLElement | null;
  return {
    renderer,
    document: window.document,
    window,
    root,
  };
};

export const startHydration = (
  renderer: DOMRenderer,
  templateFn: TemplateFn,
  isAsync = false
) => {
  if (isAsync) {
    const hydrationRoot = branchState();
    withState(hydrationRoot, () => renderer.render(templateFn));
    return;
  }
  renderer.render(templateFn);
};

export const setupHydration = async (
  templateFn: TemplateFn,
  isAsync = false
) => {
  const html = await renderHydrationServerHtml(templateFn, isAsync);
  const { renderer, document, root, window } =
    createHydrationClientRenderer(html);
  startHydration(renderer, templateFn, isAsync);
  await renderer.endHydration();

  return { html, window, document, root, renderer };
};

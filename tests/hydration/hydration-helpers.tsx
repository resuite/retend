import type { JSX } from 'retend/jsx-runtime';

import { Await, setActiveRenderer, waitForAsyncBoundaries } from 'retend';
import { renderToString } from 'retend-server/client';
import { VDOMRenderer, type VNode, VWindow } from 'retend-server/v-dom';
import { DOMRenderer } from 'retend-web';
import { setGlobalContext } from 'retend/context';
import { vi } from 'vitest';

type TemplateFn = () => JSX.Template;

const resetHydrationContext = () => {
  setGlobalContext({
    globalData: new Map(),
  });
};

export const renderHydrationServerHtml = async (
  templateFn: TemplateFn,
  isAsync = false
) => {
  resetHydrationContext();
  const serverWindow = new VWindow();
  const serverRenderer = new VDOMRenderer(serverWindow);
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
    const waitForBoundaries = waitForAsyncBoundaries();
    if (vi.isFakeTimers()) {
      // In fake-timer mode this flushes scheduled async-cell delays instantly.
      await vi.runAllTimersAsync();
    }
    await waitForBoundaries;
  }
  let stalledTeleports = false;
  while (serverWindow.document.teleportMounts.length) {
    const resolved = await serverWindow.document.mountAllTeleports();
    const waitForBoundaries = waitForAsyncBoundaries();
    if (vi.isFakeTimers()) await vi.runAllTimersAsync();
    await waitForBoundaries;
    if (!resolved && stalledTeleports) {
      throw new Error('Could not resolve Teleport target.');
    }
    stalledTeleports = resolved === 0;
  }
  return renderToString(serverWindow.document.body, serverWindow);
};

export const createHydrationClientRenderer = (html: string) => {
  const shell = `<div id="app" data-retend-hydration="1">${html}</div>`;
  window.document.body.setHTMLUnsafe(shell);
  resetHydrationContext();
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);
  const root = window.document.querySelector('#app') as HTMLElement | null;
  renderer.enableHydrationMode(root as HTMLElement);
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
    renderer.render(() =>
      Await({
        fallback: null,
        children: templateFn,
      })
    );
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
  if (isAsync) {
    const waitForBoundaries = waitForAsyncBoundaries();
    if (vi.isFakeTimers()) {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    }
    await waitForBoundaries;
    await Promise.resolve();
  }
  await renderer.endHydration();

  return { html, window, document, root, renderer };
};

import { toBlob } from 'html-to-image';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

const screenshotErrorMessage =
  'Could not copy screenshot for selected component.';

export async function copyComponentScreenshot(node: ComponentTreeNode) {
  if (!node.output) {
    throw new Error(screenshotErrorMessage);
  }

  let nodes: Node[] = [];
  if (Array.isArray(node.output)) {
    nodes = node.output;
  } else {
    nodes = [node.output];
  }

  if (nodes.length === 0) {
    throw new Error(screenshotErrorMessage);
  }

  let captureTarget: HTMLElement | null = null;
  let wrapper: HTMLDivElement | null = null;
  let parent: Node | null = null;

  try {
    if (nodes.length === 1) {
      const outputNode = nodes[0];
      if (outputNode instanceof Comment) {
        const teleportedContainer = Reflect.get(
          outputNode,
          '__retendTeleportedContainer'
        );
        if (teleportedContainer instanceof HTMLElement) {
          captureTarget = teleportedContainer;
        }
      }
      if (outputNode instanceof HTMLElement) {
        captureTarget = outputNode;
      }
    }

    if (!captureTarget) {
      const firstNode = nodes[0];
      const nextParent = firstNode.parentNode;
      if (!nextParent) {
        throw new Error(screenshotErrorMessage);
      }

      for (const outputNode of nodes) {
        if (outputNode.parentNode !== nextParent) {
          throw new Error(screenshotErrorMessage);
        }
      }

      parent = nextParent;
      wrapper = document.createElement('div');
      parent.insertBefore(wrapper, firstNode);
      wrapper.append(...nodes);
      captureTarget = wrapper;
    }

    const blob = await toBlob(captureTarget);
    if (!blob) {
      throw new Error(screenshotErrorMessage);
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } finally {
    if (wrapper && parent) {
      const fragment = document.createDocumentFragment();
      fragment.append(...nodes);
      parent.insertBefore(fragment, wrapper);
      wrapper.remove();
    }
  }
}

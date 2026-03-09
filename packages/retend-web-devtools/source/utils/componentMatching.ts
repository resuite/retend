import type {
  DevToolsDOMRenderer,
  ComponentTreeNode,
} from '@/core/devtools-renderer';

interface FindMatchingNodeOptions {
  target: Element;
  cursorX: number;
  cursorY: number;
  devRenderer: DevToolsDOMRenderer;
}

/**
 * Finds the nearest mapped component tree node for the hovered DOM element.
 */
export function matchToComponentNode(
  options: FindMatchingNodeOptions
): ComponentTreeNode | null {
  const { target, cursorX, cursorY, devRenderer } = options;
  let current: Element | null = target;

  while (current) {
    const bounds = current.getBoundingClientRect();
    const isNotInBounds =
      cursorX < bounds.left ||
      cursorX > bounds.right ||
      cursorY < bounds.top ||
      cursorY > bounds.bottom;

    if (isNotInBounds) break;

    const matchedNode = devRenderer.outputs.get(current);
    if (matchedNode) return matchedNode;

    current = current.parentElement;
  }

  return null;
}

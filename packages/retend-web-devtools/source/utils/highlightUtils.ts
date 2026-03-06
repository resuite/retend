import type {
  DevToolsDOMRenderer,
  ComponentTreeNode,
} from '@/core/devtools-renderer';

interface HighlightInfoOptions {
  node: ComponentTreeNode | null;
  hoveredElement: Element | null;
  devRenderer: DevToolsDOMRenderer;
}

interface HighlightInfoResult {
  rect: DOMRect | null;
  label: string;
}

/**
 * Computes the bounding rect and label for a component node to be highlighted.
 * If a hoveredElement is provided, uses its bounds directly.
 * Otherwise, computes the bounds from the node's output template.
 */
export function getHighlightInfo(
  options: HighlightInfoOptions
): HighlightInfoResult {
  const { node, hoveredElement } = options;

  let rect: DOMRect | null = null;
  let label = '';

  if (node && hoveredElement) {
    label = `${node.component.name}.${hoveredElement.tagName.toLowerCase()}`;
    rect = hoveredElement.getBoundingClientRect();
  } else if (node && node.output) {
    label = node.component.name;
    let flatNodes: Node[];
    if (Array.isArray(node.output)) {
      flatNodes = node.output;
    } else {
      flatNodes = [node.output];
    }
    if (flatNodes.length === 1) {
      const anchorNode = flatNodes[0];
      if (anchorNode instanceof Comment) {
        const teleportedContainer = Reflect.get(
          anchorNode,
          '__retendTeleportedContainer'
        );
        if (teleportedContainer instanceof Element) {
          flatNodes = [teleportedContainer];
        }
      }
    }
    if (flatNodes.length > 0) {
      try {
        const first = flatNodes[0];
        const last = flatNodes[flatNodes.length - 1];

        const range = document.createRange();
        range.setStartBefore(first);
        range.setEndAfter(last);
        rect = range.getBoundingClientRect();
      } catch {}
    }
  }

  return { rect, label };
}

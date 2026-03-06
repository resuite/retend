import { createNodesFromTemplate } from 'retend';

import type {
  DevToolsDOMRenderer,
  ComponentTreeNode,
} from '@/core/devtools-renderer';

interface FindMatchingNodeOptions {
  rootNode: ComponentTreeNode;
  hoveredElement: Element;
  cursorX: number;
  cursorY: number;
  devRenderer: DevToolsDOMRenderer;
}

interface NodeMatchResult {
  matchedNode: ComponentTreeNode | null;
  matchedDepth: number;
}

/**
 * Gets the rendered DOM nodes from a component tree node's output.
 * Handles special cases like teleported containers.
 */
export function getRenderedNodesFromOutput(
  node: ComponentTreeNode,
  devRenderer: DevToolsDOMRenderer
): Array<Node> {
  if (!node.output) return [];

  let renderedNodes = createNodesFromTemplate(node.output, devRenderer);

  // Handle teleported containers
  if (renderedNodes.length === 1) {
    const anchorNode = renderedNodes[0];
    if (anchorNode instanceof Comment) {
      const teleportedContainer = Reflect.get(
        anchorNode,
        '__retendTeleportedContainer'
      );
      if (teleportedContainer instanceof Element) {
        renderedNodes = [teleportedContainer];
      }
    }
  }

  return renderedNodes;
}

/**
 * Checks if a node's rendered output matches the hovered element.
 * This includes direct containment, element equality, and bounds checking.
 */
export function checkNodeMatchesElement(
  renderedNodes: Array<Node>,
  hoveredElement: Element,
  cursorX: number,
  cursorY: number
): boolean {
  // Check if any rendered node directly matches or contains the hovered element
  for (const concreteNode of renderedNodes) {
    if (concreteNode === hoveredElement) {
      return true;
    }
    if (
      concreteNode instanceof Element &&
      concreteNode.contains(hoveredElement)
    ) {
      return true;
    }
  }

  // Fall back to bounds checking using Range API
  if (renderedNodes.length > 0) {
    const first = renderedNodes[0];
    const last = renderedNodes[renderedNodes.length - 1];

    if (first.parentNode && last.parentNode) {
      try {
        const range = document.createRange();
        range.setStartBefore(first);
        range.setEndAfter(last);
        const bounds = range.getBoundingClientRect();

        return (
          cursorX >= bounds.left &&
          cursorX <= bounds.right &&
          cursorY >= bounds.top &&
          cursorY <= bounds.bottom
        );
      } catch {
        // Range operations can fail in edge cases
      }
    }
  }

  return false;
}

/**
 * Finds the component tree node that matches the hovered DOM element.
 * Uses a depth-first traversal to find the deepest (most specific) matching node.
 */
export function findMatchingComponentNode(
  options: FindMatchingNodeOptions
): NodeMatchResult {
  const { rootNode, hoveredElement, cursorX, cursorY, devRenderer } = options;

  const stack: Array<{ node: ComponentTreeNode; depth: number }> = [
    { node: rootNode, depth: 0 },
  ];

  let matchedNode: ComponentTreeNode | null = null;
  let matchedDepth = -1;

  while (stack.length > 0) {
    const stackEntry = stack.pop();
    if (!stackEntry) continue;

    const currentNode = stackEntry.node;

    // Add children to stack for traversal
    const childrenCell = devRenderer.childrenMap.get(currentNode);
    if (childrenCell) {
      const children = childrenCell.get();
      for (let i = 0; i < children.length; i += 1) {
        stack.push({ node: children[i], depth: stackEntry.depth + 1 });
      }
    }

    // Check if this node matches the hovered element
    const renderedNodes = getRenderedNodesFromOutput(currentNode, devRenderer);
    if (renderedNodes.length === 0) continue;

    const nodeMatches = checkNodeMatchesElement(
      renderedNodes,
      hoveredElement,
      cursorX,
      cursorY
    );

    if (!nodeMatches) continue;

    // Update matched node if this is a deeper match
    if (stackEntry.depth > matchedDepth) {
      matchedNode = currentNode;
      matchedDepth = stackEntry.depth;
    }
  }

  return { matchedNode, matchedDepth };
}

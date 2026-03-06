import { Cell, createNodesFromTemplate, onSetup } from 'retend';

import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/PickerButton.module.css';
import { PickerIcon } from './icons';

export function PickerButton() {
  const devRenderer = useDevToolsRenderer();
  const pickerIsOpen = Cell.source(false);

  let pickerMoveHandler: ((event: PointerEvent) => void) | undefined;
  let ancestorHoverTimer: number | null = null;
  let ancestorHoverFrom: ComponentTreeNode | null = null;

  const stopPicker = () => {
    if (pickerMoveHandler) {
      window.removeEventListener('pointermove', pickerMoveHandler, true);
      pickerMoveHandler = undefined;
    }
    if (ancestorHoverTimer !== null) {
      window.clearTimeout(ancestorHoverTimer);
      ancestorHoverTimer = null;
    }
    ancestorHoverFrom = null;
    document.documentElement.style.cursor = '';
    devRenderer.pickerCursorPosition.set(null);
    devRenderer.pickerHoveredElement.set(null);
  };

  const startPicker = () => {
    if (pickerMoveHandler) return;

    pickerMoveHandler = (event: PointerEvent) => {
      event.stopPropagation();

      devRenderer.pickerCursorPosition.set({
        x: event.clientX,
        y: event.clientY,
      });

      const hoveredElement = event.target as Element | null;
      if (!hoveredElement || !(hoveredElement instanceof Element)) {
        devRenderer.hoveredNode.set(null);
        devRenderer.pickerHoveredElement.set(null);
        return;
      }
      if (hoveredElement.closest('[data-retend-devtools]')) {
        return;
      }
      devRenderer.pickerHoveredElement.set(hoveredElement);

      let matchedNode: ComponentTreeNode | null = null;
      const rootNode = devRenderer.rootNode.get();
      if (!rootNode) {
        devRenderer.hoveredNode.set(null);
        return;
      }

      const stack: Array<{ node: ComponentTreeNode; depth: number }> = [
        { node: rootNode, depth: 0 },
      ];
      let matchedDepth = -1;

      while (stack.length > 0) {
        const stackEntry = stack.pop();
        if (!stackEntry) continue;

        const renderedNode = stackEntry.node;
        const childrenCell = devRenderer.childrenMap.get(renderedNode);
        if (childrenCell) {
          const children = childrenCell.get();
          for (let i = 0; i < children.length; i += 1) {
            stack.push({ node: children[i], depth: stackEntry.depth + 1 });
          }
        }

        if (!renderedNode.output) continue;
        let renderedNodes = createNodesFromTemplate(
          renderedNode.output,
          devRenderer
        );
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
        let nodeMatches = false;
        for (let i = 0; i < renderedNodes.length; i += 1) {
          const concreteNode = renderedNodes[i];
          if (concreteNode === hoveredElement) {
            nodeMatches = true;
            break;
          }
          if (
            concreteNode instanceof Element &&
            concreteNode.contains(hoveredElement)
          ) {
            nodeMatches = true;
            break;
          }
        }
        if (!nodeMatches && renderedNodes.length > 0) {
          const first = renderedNodes[0];
          const last = renderedNodes[renderedNodes.length - 1];
          if (first.parentNode && last.parentNode) {
            try {
              const range = document.createRange();
              range.setStartBefore(first);
              range.setEndAfter(last);
              const bounds = range.getBoundingClientRect();
              nodeMatches =
                event.clientX >= bounds.left &&
                event.clientX <= bounds.right &&
                event.clientY >= bounds.top &&
                event.clientY <= bounds.bottom;
            } catch {}
          }
        }
        if (!nodeMatches) continue;
        if (stackEntry.depth <= matchedDepth) continue;
        matchedNode = renderedNode;
        matchedDepth = stackEntry.depth;
      }

      const currentHovered = devRenderer.hoveredNode.get();
      if (currentHovered && matchedNode && currentHovered !== matchedNode) {
        let matchedIsAncestor = false;
        let current: ComponentTreeNode | null = currentHovered;
        while (current) {
          const parent = devRenderer.parentMap.get(current);
          if (!parent) {
            current = null;
            continue;
          }
          if (parent === matchedNode) {
            matchedIsAncestor = true;
            break;
          }
          current = parent;
        }

        if (matchedIsAncestor) {
          ancestorHoverFrom = currentHovered;
          if (ancestorHoverTimer !== null) {
            window.clearTimeout(ancestorHoverTimer);
          }
          ancestorHoverTimer = window.setTimeout(() => {
            if (ancestorHoverFrom === devRenderer.hoveredNode.get()) {
              devRenderer.hoveredNode.set(matchedNode);
            }
            ancestorHoverTimer = null;
            ancestorHoverFrom = null;
          }, 16);
          return;
        }
      }

      if (ancestorHoverTimer !== null) {
        window.clearTimeout(ancestorHoverTimer);
        ancestorHoverTimer = null;
      }
      ancestorHoverFrom = null;

      if (matchedNode !== currentHovered) {
        devRenderer.hoveredNode.set(matchedNode);
      }
    };

    window.addEventListener('pointermove', pickerMoveHandler, true);
    document.documentElement.style.cursor = 'crosshair';
  };

  const togglePicker = () => {
    const nextState = !pickerIsOpen.get();
    pickerIsOpen.set(nextState);
    if (nextState) {
      startPicker();
      return;
    }
    stopPicker();
  };

  onSetup(() => {
    return () => {
      stopPicker();
    };
  });

  return (
    <button
      type="button"
      class={[
        classes.headerButton,
        { [classes.headerButtonActive]: pickerIsOpen },
      ]}
      onClick={togglePicker}
      aria-label="Pick component from page"
      title="Pick component from page"
    >
      <PickerIcon />
    </button>
  );
}

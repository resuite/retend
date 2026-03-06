import { Cell, onSetup } from 'retend';

import { PickerIcon } from '@/components/icons';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/PickerButton.module.css';
import { findMatchingComponentNode } from '@/utils/componentMatching';

export function PickerButton() {
  const devRenderer = useDevToolsRenderer();
  const pickerIsOpen = Cell.source(false);

  let pickerMoveHandler: ((event: PointerEvent) => void) | undefined;

  const stopPicker = () => {
    if (pickerMoveHandler) {
      window.removeEventListener('pointermove', pickerMoveHandler, true);
      pickerMoveHandler = undefined;
    }
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

      devRenderer.pickerHoveredElement.set(hoveredElement);

      const rootNode = devRenderer.rootNode.get();
      if (!rootNode) {
        devRenderer.hoveredNode.set(null);
        return;
      }

      // Find the matching component node
      const { matchedNode } = findMatchingComponentNode({
        rootNode,
        hoveredElement,
        cursorX: event.clientX,
        cursorY: event.clientY,
        devRenderer,
      });

      const currentHovered = devRenderer.hoveredNode.get();
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

import { onSetup } from 'retend';

import { PickerIcon } from '@/components/icons';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/PickerButton.module.css';
import { matchToComponentNode } from '@/utils/componentMatching';

export function PickerButton() {
  const devRenderer = useDevToolsRenderer();
  let pickerMoveHandler: ((event: PointerEvent) => void) | null = null;
  let previousCursor = '';

  const stopPicker = () => {
    if (pickerMoveHandler) {
      window.removeEventListener('pointermove', pickerMoveHandler, true);
      document.removeEventListener('keydown', onKeyDown, true);
      pickerMoveHandler = null;
      document.documentElement.style.cursor = previousCursor;
    }
    devRenderer.hoveredNode.set(null);
    devRenderer.pickerCursorPosition.set(null);
    devRenderer.pickerHoveredElement.set(null);
    devRenderer.isPickerActive.set(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !devRenderer.isPickerActive.get()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicker();
  };

  const startPicker = () => {
    if (pickerMoveHandler) return;
    previousCursor = document.documentElement.style.cursor;
    devRenderer.isPickerActive.set(true);

    pickerMoveHandler = (event: PointerEvent) => {
      if (
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof HTMLElement &&
              node.hasAttribute('data-retend-devtools')
          )
      )
        return;

      devRenderer.pickerCursorPosition.set({
        x: event.clientX,
        y: event.clientY,
      });

      const target = event.target;
      if (!(target instanceof Element)) {
        devRenderer.hoveredNode.set(null);
        devRenderer.pickerHoveredElement.set(null);
        return;
      }

      devRenderer.pickerHoveredElement.set(target);
      const matchedNode = matchToComponentNode({
        target,
        cursorX: event.clientX,
        cursorY: event.clientY,
        devRenderer,
      });
      if (matchedNode !== devRenderer.hoveredNode.get()) {
        devRenderer.hoveredNode.set(matchedNode);
      }
    };

    window.addEventListener('pointermove', pickerMoveHandler, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.documentElement.style.cursor = 'crosshair';
  };

  const togglePicker = () => {
    if (devRenderer.isPickerActive.get()) stopPicker();
    else startPicker();
  };

  devRenderer.isPickerActive.listen((active) => {
    if (!active && pickerMoveHandler) stopPicker();
  });

  onSetup(() => () => {
    document.removeEventListener('keydown', onKeyDown, true);
    stopPicker();
  });

  return (
    <button
      type="button"
      class={[
        classes.headerButton,
        { [classes.headerButtonActive]: devRenderer.isPickerActive },
      ]}
      onClick={togglePicker}
      aria-label="Pick component from page (Escape to cancel)"
      aria-pressed={devRenderer.isPickerActive}
      title="Pick component from page (Esc to cancel)"
    >
      <PickerIcon />
    </button>
  );
}

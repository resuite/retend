import { PickerIcon } from '@/components/icons';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/PickerButton.module.css';
import { matchToComponentNode } from '@/utils/componentMatching';

export function PickerButton() {
  const devRenderer = useDevToolsRenderer();

  let pickerMoveHandler: ((event: PointerEvent) => void) | undefined;

  const stopPicker = () => {
    if (pickerMoveHandler) {
      window.removeEventListener('pointermove', pickerMoveHandler, true);
      pickerMoveHandler = undefined;
    }
    document.documentElement.style.cursor = '';
    devRenderer.pickerCursorPosition.set(null);
    devRenderer.pickerHoveredElement.set(null);
    devRenderer.isPickerActive.set(false);
  };

  const startPicker = () => {
    if (pickerMoveHandler) return;
    devRenderer.isPickerActive.set(true);

    pickerMoveHandler = (event: PointerEvent) => {
      event.stopPropagation();

      devRenderer.pickerCursorPosition.set({
        x: event.clientX,
        y: event.clientY,
      });

      const target = event.target as Element | null;
      if (!target || !(target instanceof Element)) {
        devRenderer.hoveredNode.set(null);
        devRenderer.pickerHoveredElement.set(null);
        return;
      }

      devRenderer.pickerHoveredElement.set(target);

      const rootNode = devRenderer.rootNode.get();
      if (!rootNode) {
        devRenderer.hoveredNode.set(null);
        return;
      }

      const cursorX = event.clientX;
      const cursorY = event.clientY;

      // Find the matching component node
      const matchedNode = matchToComponentNode({
        target,
        cursorX,
        cursorY,
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
    const nextState = !devRenderer.isPickerActive.get();
    if (nextState) {
      startPicker();
      return;
    }
    stopPicker();
  };

  devRenderer.isPickerActive.listen((isActive) => {
    if (!isActive && pickerMoveHandler) stopPicker();
  });

  return (
    <button
      type="button"
      class={[
        classes.headerButton,
        { [classes.headerButtonActive]: devRenderer.isPickerActive },
      ]}
      onClick={togglePicker}
      aria-label="Pick component from page"
      title="Pick component from page"
    >
      <PickerIcon />
    </button>
  );
}

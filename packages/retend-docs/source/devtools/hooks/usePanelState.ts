import { Cell } from 'retend';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';

export function usePanelState() {
  const devRenderer = useDevToolsRenderer();
  const panelIsOpen = Cell.source(false);

  const isBottomRight = Cell.derived(
    () => devRenderer.panelPosition.get() === 'bottom-right'
  );
  const isBottomLeft = Cell.derived(
    () => devRenderer.panelPosition.get() === 'bottom-left'
  );
  const isTopRight = Cell.derived(
    () => devRenderer.panelPosition.get() === 'top-right'
  );
  const isTopLeft = Cell.derived(
    () => devRenderer.panelPosition.get() === 'top-left'
  );

  const isInspectorLeft = Cell.derived(() => {
    if (isBottomRight.get()) {
      return true;
    }
    return isTopRight.get();
  });
  const isInspectorRight = Cell.derived(() => !isInspectorLeft.get());

  const togglePanel = () => {
    panelIsOpen.set(!panelIsOpen.get());
  };

  return {
    isBottomLeft,
    isBottomRight,
    isInspectorLeft,
    isInspectorRight,
    isTopLeft,
    isTopRight,
    panelIsOpen,
    togglePanel,
  };
}

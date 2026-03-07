import { Cell } from 'retend';

export function usePanelState() {
  const panelIsOpen = Cell.source(false);
  const isInspectorLeft = Cell.source(true);
  const isInspectorRight = Cell.derived(() => !isInspectorLeft.get());
  const panelPosition = Cell.source<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('bottom-right');

  const togglePanel = () => {
    panelIsOpen.set(!panelIsOpen.get());
  };

  return {
    isInspectorLeft,
    isInspectorRight,
    panelIsOpen,
    panelPosition,
    togglePanel,
  };
}

export type PanelState = ReturnType<typeof usePanelState>;

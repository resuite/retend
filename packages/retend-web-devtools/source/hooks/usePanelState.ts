import { Cell } from 'retend';

export function usePanelState() {
  const panelIsOpen = Cell.source(false);
  const isInspectorLeft = Cell.source(true);
  const isInspectorRight = Cell.derived(() => !isInspectorLeft.get());

  const togglePanel = () => {
    panelIsOpen.set(!panelIsOpen.get());
  };

  return {
    isInspectorLeft,
    isInspectorRight,
    panelIsOpen,
    togglePanel,
  };
}

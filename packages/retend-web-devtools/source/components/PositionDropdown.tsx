import { Cell, For, If } from 'retend';

import type { PanelState } from '@/hooks/usePanelState';

import { PositionIcon } from '@/components/icons';
import headerButtonClasses from '@/styles/PickerButton.module.css';
import dropdownClasses from '@/styles/PositionDropdown.module.css';

export function PositionDropdown({ panel }: { panel: PanelState }) {
  const isOpen = Cell.source(false);
  const isTopLeft = Cell.derived(
    () => panel.panelPosition.get() === 'top-left'
  );
  const isTopRight = Cell.derived(
    () => panel.panelPosition.get() === 'top-right'
  );
  const isBottomLeft = Cell.derived(
    () => panel.panelPosition.get() === 'bottom-left'
  );
  const isBottomRight = Cell.derived(
    () => panel.panelPosition.get() === 'bottom-right'
  );

  const toggleDropdown = () => {
    isOpen.set(!isOpen.get());
  };

  const closeDropdown = () => {
    isOpen.set(false);
  };

  const setPosition = (
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ) => {
    panel.panelPosition.set(position);
    closeDropdown();
  };

  // Close dropdown on click outside logic could be here if we can attach to document
  // but for simplicity clicking a button will set it and close.

  const positions: Array<{
    value: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    label: string;
    isActive: Cell<boolean>;
  }> = [
    { value: 'top-left', label: 'Top Left', isActive: isTopLeft },
    { value: 'top-right', label: 'Top Right', isActive: isTopRight },
    { value: 'bottom-left', label: 'Bottom Left', isActive: isBottomLeft },
    { value: 'bottom-right', label: 'Bottom Right', isActive: isBottomRight },
  ];

  return (
    <div class={dropdownClasses.dropdownContainer}>
      <button
        type="button"
        title="Position Panel"
        class={[
          headerButtonClasses.headerButton,
          { [headerButtonClasses.headerButtonActive]: isOpen },
        ]}
        onClick={toggleDropdown}
      >
        <PositionIcon />
      </button>

      {If(isOpen, () => (
        <div class={dropdownClasses.dropdownMenu}>
          {For(positions, (p) => (
            <button
              type="button"
              class={[
                dropdownClasses.dropdownItem,
                { [dropdownClasses.dropdownItemActive]: p.isActive },
              ]}
              onClick={() => setPosition(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

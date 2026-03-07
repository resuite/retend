import { Cell, For, If } from 'retend';

import type { PanelState } from '@/hooks/usePanelState';

import { PositionIcon } from '@/components/icons';
import headerButtonClasses from '@/styles/PickerButton.module.css';
import dropdownClasses from '@/styles/PositionDropdown.module.css';

export function PositionDropdown({ panel }: { panel: PanelState }) {
  const isOpen = Cell.source(false);

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
  }> = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
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
          {For(positions, (p) => {
            const isActive = Cell.derived(
              () => panel.panelPosition.get() === p.value
            );
            return (
              <button
                type="button"
                class={[
                  dropdownClasses.dropdownItem,
                  { [dropdownClasses.dropdownItemActive]: isActive },
                ]}
                onClick={() => setPosition(p.value)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

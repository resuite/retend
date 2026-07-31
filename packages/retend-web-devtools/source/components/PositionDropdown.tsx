import { Cell, For, If, onSetup } from 'retend';

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

  const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const path = event.composedPath();
    const isInsideDropdown = path.some(
      (item) =>
        item instanceof HTMLElement &&
        item.dataset.positionDropdown !== undefined
    );
    if (isInsideDropdown) return;
    closeDropdown();
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeDropdown();
  };

  onSetup(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  });

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
    <div class={dropdownClasses.dropdownContainer} data-position-dropdown>
      <button
        type="button"
        title="Position panel"
        aria-label="Position panel"
        aria-expanded={isOpen}
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

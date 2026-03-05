import { Cell, For, If, onSetup } from 'retend';

import type { PanelPosition } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/PanelPositionPicker.module.css';
import { CheckIcon, PositionIcon } from './icons';

const positionOptions: Array<{ value: PanelPosition; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

export function PanelPositionPicker() {
  const devRenderer = useDevToolsRenderer();
  const menuIsOpen = Cell.source(false);
  const wrapperRef = Cell.source<HTMLElement | null>(null);

  const toggleMenu = () => {
    menuIsOpen.set(!menuIsOpen.get());
  };

  const selectPosition = (position: PanelPosition) => {
    devRenderer.panelPosition.set(position);
    menuIsOpen.set(false);
  };

  onSetup(() => {
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.get();
      if (!wrapper) return;
      const target = event.target as Node | null;
      if (wrapper.contains(target)) return;
      menuIsOpen.set(false);
    };

    window.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
    return () => {
      window.removeEventListener(
        'pointerdown',
        closeOnOutsidePointerDown,
        true
      );
    };
  });

  return (
    <div class={classes.positionPicker} ref={wrapperRef}>
      <button
        type="button"
        class={[
          classes.headerButton,
          { [classes.headerButtonActive]: menuIsOpen },
        ]}
        onClick={toggleMenu}
        aria-label="Panel position"
        title="Panel position"
      >
        <PositionIcon />
      </button>
      {If(menuIsOpen, () => (
        <div
          class={classes.positionMenu}
          role="menu"
          aria-label="Panel position"
        >
          {For(positionOptions, (option) => {
            const isSelected = Cell.derived(() => {
              return devRenderer.panelPosition.get() === option.value;
            });
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                class={[
                  classes.positionOption,
                  { [classes.positionOptionActive]: isSelected },
                ]}
                onClick={() => selectPosition(option.value)}
              >
                {option.label}
                {If(isSelected, () => (
                  <span class={classes.positionOptionMark}>
                    <CheckIcon />
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

import { Cell, If, onConnected } from 'retend';
import { Teleport } from 'retend-web';

import type { DevToolsDOMRenderer } from './devtools-renderer';

import { ComponentTree } from './ComponentTree';
import { HighlightOverlay } from './HighlightOverlay';
import classes from './Panel.module.css';
import { PickerButton } from './PickerButton';

interface PanelProps {
  devRenderer: DevToolsDOMRenderer;
}

export function Panel(props: PanelProps) {
  const { devRenderer } = props;
  const panelIsOpen = Cell.source(false);
  const contentRef = Cell.source<HTMLElement | null>(null);

  const togglePanel = () => {
    panelIsOpen.set(!panelIsOpen.get());
  };

  onConnected(contentRef, (contentEl) => {
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const onPointerMove = (e: PointerEvent) => {
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      contentEl.style.width = `${startWidth + dx}px`;
      contentEl.style.height = `${startHeight + dy}px`;
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    const handle = contentEl.querySelector<HTMLElement>(
      `.${classes.resizeHandle}`
    );
    if (!handle) return;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
      startWidth = contentEl.offsetWidth;
      startHeight = contentEl.offsetHeight;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
  });

  return (
    <Teleport to="body">
      <div class={classes.panel} data-retend-devtools="">
        {If(panelIsOpen, () => {
          return (
            <div class={classes.content} ref={contentRef}>
              <div class={classes.resizeHandle} />
              <div class={classes.header}>
                <span class={classes.title}>Component Tree</span>
                <PickerButton devRenderer={devRenderer} />
              </div>
              <ComponentTree devRenderer={devRenderer} />
            </div>
          );
        })}
        <button type="button" class={classes.button} onClick={togglePanel}>
          RT
        </button>
      </div>
      <HighlightOverlay devRenderer={devRenderer} />
    </Teleport>
  );
}

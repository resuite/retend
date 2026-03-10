import { Cell, type SourceCell } from 'retend';

import type { usePanelState } from '@/hooks/usePanelState';

export function useFling(
  panel: ReturnType<typeof usePanelState>,
  panelRef: SourceCell<HTMLElement | null>
) {
  const dragOffset = Cell.source({ x: 0, y: 0 });
  const isDragging = Cell.source(false);
  const isFlinging = Cell.source(false);

  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let flingTimeout: ReturnType<typeof setTimeout> | null = null;
  let shouldSkipClick = false;

  const style = Cell.derived(() => {
    const { x, y } = dragOffset.get();
    if (x === 0 && y === 0 && !isFlinging.get()) {
      return undefined;
    }
    return { transform: `translate(${x}px, ${y}px)` };
  });

  const onPointerDown = (event: PointerEvent) => {
    if (panel.panelIsOpen.get()) {
      return;
    }

    if (flingTimeout) {
      clearTimeout(flingTimeout);
      flingTimeout = null;
    }

    isFlinging.set(false);
    dragOffset.set({ x: 0, y: 0 });

    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = performance.now();
    velocityX = 0;
    velocityY = 0;
    shouldSkipClick = false;

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;

    if (!shouldSkipClick && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      return;
    }

    shouldSkipClick = true;
    isDragging.set(true);
    dragOffset.set({ x: dx, y: dy });

    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocityX = velocityX * 0.4 + ((event.clientX - lastX) / dt) * 0.6;
      velocityY = velocityY * 0.4 + ((event.clientY - lastY) / dt) * 0.6;
    }
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = now;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    dragPointerId = null;
    isDragging.set(false);

    if (!shouldSkipClick) {
      dragOffset.set({ x: 0, y: 0 });
      return;
    }

    const factor = 200;
    const targetX = event.clientX + velocityX * factor;
    const targetY = event.clientY + velocityY * factor;

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    let nextPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

    if (targetY < halfH) {
      nextPosition = targetX < halfW ? 'top-left' : 'top-right';
    } else {
      nextPosition = targetX < halfW ? 'bottom-left' : 'bottom-right';
    }

    const panelContainer = panelRef.get();

    if (!panelContainer) {
      panel.panelPosition.set(nextPosition);
      dragOffset.set({ x: 0, y: 0 });
      return;
    }

    Cell.batch(() => {
      const startRect = panelContainer.getBoundingClientRect();

      panel.panelPosition.set(nextPosition);
      dragOffset.set({ x: 0, y: 0 });
      isFlinging.set(false);

      requestAnimationFrame(() => {
        const endRect = panelContainer.getBoundingClientRect();
        const invertX = startRect.left - endRect.left;
        const invertY = startRect.top - endRect.top;

        dragOffset.set({ x: invertX, y: invertY });

        requestAnimationFrame(() => {
          isFlinging.set(true);
          dragOffset.set({ x: 0, y: 0 });

          flingTimeout = setTimeout(() => {
            isFlinging.set(false);
          }, 400);
        });
      });
    });
  };

  const getShouldSkipClick = () => shouldSkipClick;
  const setShouldSkipClick = (val: boolean) => {
    shouldSkipClick = val;
  };

  return {
    isDragging,
    isFlinging,
    style,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    getShouldSkipClick,
    setShouldSkipClick,
  };
}

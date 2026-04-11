import type { PointerEvent } from 'retend-canvas-2d';

import { Cell } from 'retend';

import { useWindowSize } from './useWindowSize';

interface Transform {
  tx: number;
  ty: number;
  rotate: number;
}

let topZIndex = 0;

function clampPosition(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

export function useDragGesture(
  initialTransform: Transform | undefined,
  isSelected: Cell<boolean>,
  onDismiss: (() => void) | undefined
) {
  const { width: innerWidth, height: innerHeight } = useWindowSize();
  const tx = Cell.source(initialTransform?.tx ?? 0);
  const ty = Cell.source(initialTransform?.ty ?? 0);
  const dismissTx = Cell.source(0);
  const dismissTy = Cell.source(0);
  const isDragging = Cell.source(false);
  const hasMoved = Cell.source(false);
  const zIndexHandle = Cell.source(0);

  const DRAG_THRESHOLD = 5; // pixels

  const cursor = Cell.derived(() => (isDragging.get() ? 'grabbing' : 'grab'));
  const zIndex = Cell.derived(() => {
    return isDragging.get() ? 98 : zIndexHandle.get();
  });

  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let lastY = 0;
  let lastMoveTime = 0;
  let dismissVelocityY = 0;

  const handlePointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    e.currentTarget?.setPointerCapture(e.pointerId);
    startX = e.x;
    startY = e.y;
    baseX = tx.get();
    baseY = ty.get();
    lastY = e.y;
    lastMoveTime = performance.now();
    dismissVelocityY = 0;
    isDragging.set(true);
    hasMoved.set(false);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.get()) return;

    const dx = e.x - startX;
    const dy = e.y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > DRAG_THRESHOLD) {
      hasMoved.set(true);
    }

    const now = performance.now();
    const elapsed = now - lastMoveTime;
    if (elapsed > 0) {
      dismissVelocityY = (e.y - lastY) / elapsed;
    }
    lastY = e.y;
    lastMoveTime = now;

    if (isSelected.get()) {
      Cell.batch(() => {
        dismissTx.set(dx * 0.35);
        dismissTy.set(dy);
      });
      return;
    }

    const maxX = innerWidth.get() / 2;
    const maxY = innerHeight.get() / 2;

    Cell.batch(() => {
      tx.set(clampPosition(baseX + e.x - startX, maxX));
      ty.set(clampPosition(baseY + e.y - startY, maxY));
    });
  };

  const handlePointerUp = (e: PointerEvent) => {
    isDragging.set(false);
    e.currentTarget?.releasePointerCapture(e.pointerId);

    if (isSelected.get()) {
      const shouldDismiss =
        Math.abs(dismissTy.get()) > innerHeight.get() * 0.2 ||
        Math.abs(dismissVelocityY) > 1;
      dismissTx.set(0);
      dismissTy.set(0);
      if (shouldDismiss) onDismiss?.();
      return;
    }

    zIndexHandle.set(++topZIndex);
  };

  return {
    tx,
    ty,
    dismissTx,
    dismissTy,
    isDragging,
    hasMoved,
    zIndex,
    cursor,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

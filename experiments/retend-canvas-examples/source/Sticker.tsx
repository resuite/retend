import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';
import {
  Alignment,
  Angle,
  Duration,
  Easing,
  Length,
  type TransitionableStyleKey,
} from 'retend-canvas';

import type { Sticker as StickerType } from './data';

import { useDragGesture } from './useDragGesture';

interface Transform {
  tx: number;
  ty: number;
  rotate: number;
}

interface StickerProps extends StickerType {
  index?: Cell<number>;
  initialTransform?: Transform;
  height: number;
  selected?: Cell<StickerType | null>;
  onSelect?: (item: StickerType) => void;
  onDismiss?: () => void;
}

function createStyle(
  drag: ReturnType<typeof useDragGesture>,
  props: StickerProps,
  isSelected: Cell<boolean>
) {
  const { initialTransform, height: heightRaw } = props;

  const style = Cell.derived((): JSX.StyleValue => {
    const transitionProperty: TransitionableStyleKey[] = drag.isDragging.get()
      ? ['scale', 'rotate', 'opacity']
      : ['scale', 'translate', 'rotate', 'opacity'];

    const baseStyles: JSX.Style = {
      height: Length.Px(heightRaw),
      width: Length.Px(heightRaw * 0.8),
      alignSelf: Alignment.Center,
      justifySelf: Alignment.Center,
      backgroundColor: 'red',
      borderWidth: Length.Px(2),
      transitionDuration: Duration.Ms(500),
    };

    if (isSelected.get()) {
      return {
        ...baseStyles,
        rotate: Angle.Deg(0),
        scale: 2.5,
        translate: [
          Length.Px(drag.dismissTx.get()),
          Length.Px(drag.dismissTy.get()),
        ],
        transitionProperty,
        // transitionTimingFunction: 'var(--ease-spring)',
      };
    }

    return {
      ...baseStyles,
      rotate: Angle.Deg(initialTransform?.rotate ?? 0),
      scale: drag.isDragging.get() && drag.hasMoved.get() ? 1.3 : 1,
      translate: [Length.Px(drag.tx.get()), Length.Px(drag.ty.get())],
      transitionProperty,
      transitionTimingFunction: Easing.Ease,
    };
  });

  return style;
}

export function Sticker(props: StickerProps) {
  const { initialTransform, selected, onSelect, onDismiss, ...sticker } = props;

  const isSelected = Cell.derived(() => {
    return selected?.get()?.name === sticker.name;
  });

  const drag = useDragGesture(initialTransform, isSelected, onDismiss);
  const style = createStyle(drag, props, isSelected);

  const handleClick = () => {
    if (drag.hasMoved.get()) return;
    onSelect?.(sticker);
  };

  return (
    <rect
      style={style}
      onClick={handleClick}
      onPointerDown={drag.handlePointerDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
    ></rect>
  );
}

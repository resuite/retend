import { Cell } from 'retend';
import {
  Alignment,
  Angle,
  type AnimatableProperty,
  type AnimationDefinition,
  type CanvasStyleValue,
  Duration,
  Easing,
  Length,
  PointerEvents,
  TextAlign,
} from 'retend-canvas-2d';

import type { Sticker as StickerType } from './data';

import { useDragGesture } from './useDragGesture';

interface Transform {
  tx: number;
  ty: number;
  rotate: number;
}

interface StickerProps extends StickerType {
  index: Cell<number>;
  initialTransform?: Transform;
  height: number;
  selected: Cell<StickerType | null>;
  onSelect?: (item: StickerType) => void;
  onDismiss?: () => void;
}

const fromInitial: AnimationDefinition = {
  from: {
    translate: [Length.Px(0), Length.Pct(50)],
    rotate: Angle.Deg(0),
  },
  '40%': {
    translate: Length.Px(0),
    rotate: Angle.Deg(0),
  },
};

function createStyle(
  drag: ReturnType<typeof useDragGesture>,
  props: StickerProps,
  isSelected: Cell<boolean>,
  selected: Cell<StickerType | null>
) {
  const { initialTransform, height: heightRaw } = props;
  const isNotSelected = Cell.derived(() => {
    const selectedItem = selected.get();
    return selectedItem && selectedItem.name !== props.name;
  });

  const style = Cell.derived((): CanvasStyleValue => {
    const index = props.index.get() ?? 0;
    const transitionProperty: AnimatableProperty[] = drag.isDragging.get()
      ? ['scale', 'rotate', 'opacity']
      : ['scale', 'translate', 'rotate', 'opacity'];
    const pointerEvents = isNotSelected.get()
      ? PointerEvents.None
      : PointerEvents.Auto;

    const baseStyles: CanvasStyleValue = {
      height: Length.Px(heightRaw),
      width: Length.Px(heightRaw * 0.8),
      alignSelf: Alignment.Center,
      justifySelf: Alignment.Center,
      backgroundColor: 'brown',
      borderColor: 'white',
      borderWidth: Length.Px(2),
      pointerEvents,
      transitionProperty,
      transitionDuration: Duration.Ms(500),
      transitionTimingFunction: Easing.CubicBezier(0.16, 1, 0.3, 1),
      animationName: fromInitial,
      animationDuration: Duration.Ms(400 + (index + 1) * 20),
      animationTimingFunction: Easing.CubicBezier(0.16, 1, 0.3, 1),
    };

    if (isSelected.get()) {
      return {
        ...baseStyles,
        rotate: Angle.Deg(0),
        zIndex: 99,
        scale: 2.5,
        translate: [
          Length.Px(drag.dismissTx.get()),
          Length.Px(drag.dismissTy.get()),
        ],
      };
    }

    return {
      ...baseStyles,
      zIndex: drag.zIndex,
      rotate: Angle.Deg(initialTransform?.rotate ?? 0),
      scale: drag.isDragging.get() && drag.hasMoved.get() ? 1.3 : 1,
      translate: [Length.Px(drag.tx.get()), Length.Px(drag.ty.get())],
    };
  });

  return style;
}

export function Sticker(props: StickerProps) {
  const { initialTransform, selected, onSelect, onDismiss, ...sticker } = props;

  const isSelected = Cell.derived(() => {
    return selected.get()?.name === sticker.name;
  });

  const drag = useDragGesture(initialTransform, isSelected, onDismiss);
  const style = createStyle(drag, props, isSelected, selected);

  const handleClick = () => {
    if (selected.get() || drag.hasMoved.get()) return;
    onSelect?.(sticker);
  };

  return (
    <rect
      style={style}
      onClick={handleClick}
      onPointerDown={drag.handlePointerDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
    >
      <text
        style={{
          width: Length.Pct(100),
          alignSelf: Alignment.Center,
          justifySelf: Alignment.Center,
          textAlign: TextAlign.Center,
        }}
      >
        {sticker.name}
      </text>
    </rect>
  );
}

import { Cell } from 'retend';

import type { HighlightColor } from '@/core/devtools-renderer';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/HighlightColorPicker.module.css';

export interface PaletteColorOption {
  value: HighlightColor;
  label: string;
  className: string;
}

interface PaletteColorButtonProps {
  option: PaletteColorOption;
}

export function PaletteColorButton(props: PaletteColorButtonProps) {
  const { option } = props;
  const devRenderer = useDevToolsRenderer();
  const isActive = Cell.derived(() => {
    return devRenderer.highlightColor.get() === option.value;
  });

  return (
    <button
      type="button"
      class={[
        classes.paletteColor,
        option.className,
        { [classes.paletteColorActive]: isActive },
      ]}
      onClick={() => devRenderer.highlightColor.set(option.value)}
      aria-label={option.label}
      title={option.label}
    />
  );
}

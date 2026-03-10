import { For } from 'retend';

import type { HighlightColor } from '@/core/devtools-renderer';

import { PaletteColorButton } from '@/components/PaletteColorButton';
import classes from '@/styles/HighlightColorPicker.module.css';

const colorOptions: Array<{
  value: HighlightColor;
  label: string;
  className: string;
}> = [
  {
    value: 'amber',
    label: 'Amber accent',
    className: classes.paletteAmber,
  },
  { value: 'blue', label: 'Blue accent', className: classes.paletteBlue },
  { value: 'pink', label: 'Pink accent', className: classes.palettePink },
  { value: 'green', label: 'Green accent', className: classes.paletteGreen },
  { value: 'red', label: 'Red accent', className: classes.paletteRed },
];

export function HighlightColorPicker() {
  return (
    <div class={classes.palette} role="group" aria-label="Accent color">
      {For(colorOptions, (option) => (
        <PaletteColorButton option={option} />
      ))}
    </div>
  );
}

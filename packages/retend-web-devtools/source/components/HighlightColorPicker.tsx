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
    label: 'Amber theme',
    className: classes.paletteAmber,
  },
  { value: 'blue', label: 'Blue theme', className: classes.paletteBlue },
  { value: 'pink', label: 'Pink theme', className: classes.palettePink },
  { value: 'green', label: 'Green theme', className: classes.paletteGreen },
  { value: 'red', label: 'Red theme', className: classes.paletteRed },
];

export function HighlightColorPicker() {
  return (
    <div class={classes.palette} role="group" aria-label="DevTools theme">
      {For(colorOptions, (option) => (
        <PaletteColorButton option={option} />
      ))}
    </div>
  );
}

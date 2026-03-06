import { For } from 'retend';

import type { HighlightColor } from '@/core/devtools-renderer';

import { PaletteColorButton } from '@/components/PaletteColorButton';
import classes from '@/styles/HighlightColorPicker.module.css';

const colorOptions: Array<{
  value: HighlightColor;
  label: string;
  className: string;
}> = [
  { value: 'blue', label: 'Blue highlight', className: classes.paletteBlue },
  { value: 'pink', label: 'Pink highlight', className: classes.palettePink },
  { value: 'green', label: 'Green highlight', className: classes.paletteGreen },
  { value: 'red', label: 'Red highlight', className: classes.paletteRed },
  {
    value: 'amber',
    label: 'Amber highlight',
    className: classes.paletteAmber,
  },
];

export function HighlightColorPicker() {
  return (
    <div class={classes.palette} role="group" aria-label="Highlight color">
      {For(colorOptions, (option) => (
        <PaletteColorButton option={option} />
      ))}
    </div>
  );
}

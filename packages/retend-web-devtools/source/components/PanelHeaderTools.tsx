import { HighlightColorPicker } from '@/components/HighlightColorPicker';
import { PickerButton } from '@/components/PickerButton';
import classes from '@/styles/PanelHeaderTools.module.css';

export function PanelHeaderTools() {
  return (
    <div class={classes.headerTools}>
      <HighlightColorPicker />
      <PickerButton />
    </div>
  );
}

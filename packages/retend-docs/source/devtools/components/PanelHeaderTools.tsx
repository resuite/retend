import classes from '../styles/PanelHeaderTools.module.css';
import { HighlightColorPicker } from './HighlightColorPicker';
import { PanelPositionPicker } from './PanelPositionPicker';
import { PickerButton } from './PickerButton';

export function PanelHeaderTools() {
  return (
    <div class={classes.headerTools}>
      <HighlightColorPicker />
      <PanelPositionPicker />
      <PickerButton />
    </div>
  );
}

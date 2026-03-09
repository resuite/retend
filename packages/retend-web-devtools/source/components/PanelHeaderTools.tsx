import type { PanelState } from '@/hooks/usePanelState';

import { HighlightColorPicker } from '@/components/HighlightColorPicker';
import { PickerButton } from '@/components/PickerButton';
import { PositionDropdown } from '@/components/PositionDropdown';
import classes from '@/styles/PanelHeaderTools.module.css';

export function PanelHeaderTools({ panel }: { panel: PanelState }) {
  return (
    <div class={classes.headerTools}>
      <HighlightColorPicker />
      <PositionDropdown panel={panel} />
      <PickerButton />
    </div>
  );
}

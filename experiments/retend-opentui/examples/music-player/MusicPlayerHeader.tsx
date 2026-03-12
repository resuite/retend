import { TextAttributes } from '@opentui/core';
import { Cell, type Cell as CellType } from 'retend';

import { useMusicPlayerScope } from './MusicPlayerScope';

interface MusicPlayerHeaderProps {
  direction: CellType<'column' | 'row'>;
}

export function MusicPlayerHeader(props: MusicPlayerHeaderProps) {
  const { direction } = props;
  const { accent, isPlaying } = useMusicPlayerScope();
  const statusAttributes = Cell.derived(() =>
    isPlaying.get() ? TextAttributes.BOLD : TextAttributes.DIM
  );
  const statusIcon = Cell.derived(() => (isPlaying.get() ? '⏵' : '⏸'));

  return (
    <box
      width="100%"
      flexDirection={direction}
      justifyContent="space-between"
      marginBottom={1}
    >
      <box flexDirection="row">
        <text
          fg={accent}
          attributes={statusAttributes}
          content={Cell.derived(() => `${statusIcon.get()} `)}
        />
        <text fg="white" attributes={TextAttributes.BOLD}>
          RETEND
        </text>
        <text fg="gray"> AUDIO</text>
      </box>
      <text fg="gray" attributes={TextAttributes.DIM}>
        [space] play/pause • [↑/↓] track • [←/→] vol
      </text>
    </box>
  );
}

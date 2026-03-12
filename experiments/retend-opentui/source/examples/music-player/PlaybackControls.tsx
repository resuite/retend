import { TextAttributes } from '@opentui/core';
import { Cell, type Cell as CellType } from 'retend';

import { useMusicPlayerScope } from './MusicPlayerScope';

interface PlaybackControlsProps {
  direction: CellType<'column' | 'row'>;
  marginTop: CellType<number>;
}

export function PlaybackControls(props: PlaybackControlsProps) {
  const { direction, marginTop } = props;
  const {
    accent,
    decreaseVolume,
    increaseVolume,
    isPlaying,
    nextTrack,
    previousTrack,
    togglePlayback,
    volume,
  } = useMusicPlayerScope();
  const status = Cell.derived(() => (isPlaying.get() ? 'PLAYING ' : 'PAUSED '));
  const volumeBar = Cell.derived(() => {
    const filled = Math.max(0, Math.round(volume.get() / 10));
    const empty = Math.max(0, 10 - filled);
    return `${'■'.repeat(filled)}${'□'.repeat(empty)}`;
  });

  return (
    <box
      width="100%"
      flexDirection={direction}
      justifyContent="space-between"
      alignItems="center"
    >
      <box flexDirection="row">
        <box onMouseDown={previousTrack}>
          <text fg="gray" attributes={TextAttributes.DIM}>
            ⏮ PREV{' '}
          </text>
        </box>
        <text fg="gray"> </text>
        <box onMouseDown={togglePlayback}>
          <text fg="white" attributes={TextAttributes.BOLD} content={status} />
        </box>
        <text fg="gray"> </text>
        <box onMouseDown={nextTrack}>
          <text fg="gray" attributes={TextAttributes.DIM}>
            ⏭ NEXT
          </text>
        </box>
      </box>
      <box flexDirection="row" marginTop={marginTop}>
        <box onMouseDown={decreaseVolume}>
          <text fg="gray">[-]</text>
        </box>
        <text fg="gray"> </text>
        <text fg="gray">VOL </text>
        <text fg={accent} content={volumeBar} />
        <text fg="gray"> </text>
        <box onMouseDown={increaseVolume}>
          <text fg="gray">[+]</text>
        </box>
      </box>
    </box>
  );
}

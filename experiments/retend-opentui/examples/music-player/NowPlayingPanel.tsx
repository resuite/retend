import { TextAttributes } from '@opentui/core';
import { Cell, type Cell as CellType } from 'retend';

import { progressWidth } from './constants';
import { useMusicPlayerScope } from './MusicPlayerScope';
import { PlaybackControls } from './PlaybackControls';
import { QueuePanel } from './QueuePanel';

interface NowPlayingPanelProps {
  controlsDirection: CellType<'column' | 'row'>;
  controlsMarginTop: CellType<number>;
  width: CellType<number | '100%'>;
}

export function NowPlayingPanel(props: NowPlayingPanelProps) {
  const { controlsDirection, controlsMarginTop, width } = props;
  const { accent, currentTrack, elapsed } = useMusicPlayerScope();
  const artist = Cell.derived(() => currentTrack.get().artist);
  const durationLabel = Cell.derived(() => {
    const total = currentTrack.get().duration;
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
  const elapsedLabel = Cell.derived(() => {
    const total = Math.floor(elapsed.get());
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
  const progressBar = Cell.derived(() => {
    const track = currentTrack.get();
    const filled = Math.max(
      0,
      Math.round((elapsed.get() / track.duration) * progressWidth)
    );
    const empty = Math.max(0, progressWidth - filled);
    if (filled === 0) return '┣' + '┄'.repeat(Math.max(0, progressWidth - 1));
    if (filled >= progressWidth) {
      return '━'.repeat(Math.max(0, progressWidth - 1)) + '┫';
    }
    return `${'━'.repeat(filled - 1)}┫${'┄'.repeat(empty)}`;
  });
  const title = Cell.derived(() => currentTrack.get().title);

  return (
    <box width={width} flexGrow={1} flexDirection="column">
      <text fg="gray" attributes={TextAttributes.BOLD}>
        NOW SPINNING
      </text>
      <text fg="white" attributes={TextAttributes.BOLD} content={title} />
      <text fg={accent} content={artist} />
      <box width="100%" marginTop={1} marginBottom={1} flexDirection="column">
        <text fg={accent} content={progressBar} />
        <box
          width="100%"
          flexDirection="row"
          justifyContent="space-between"
          marginTop={1}
        >
          <text fg="white" content={elapsedLabel} />
          <text fg="gray" content={durationLabel} />
        </box>
      </box>
      <PlaybackControls
        direction={controlsDirection}
        marginTop={controlsMarginTop}
      />
      <QueuePanel />
    </box>
  );
}

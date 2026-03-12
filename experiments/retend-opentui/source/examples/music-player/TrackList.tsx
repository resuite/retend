import { TextAttributes } from '@opentui/core';
import { Cell, For } from 'retend';

import { tracks } from './constants';
import { useMusicPlayerScope } from './MusicPlayerScope';

export function TrackList() {
  const { accent, currentIndex, selectTrack } = useMusicPlayerScope();

  return (
    <box width="100%" flexDirection="column">
      {For(tracks, (track, index) => {
        const isActive = Cell.derived(() => currentIndex.get() === index.get());
        const fg = Cell.derived(() => (isActive.get() ? accent.get() : 'gray'));
        const attributes = Cell.derived(() =>
          isActive.get() ? TextAttributes.BOLD : TextAttributes.NONE
        );
        const artistAttributes = Cell.derived(() =>
          isActive.get() ? TextAttributes.NONE : TextAttributes.DIM
        );
        const handleMouseDown = () => selectTrack(index.get());
        const position = Cell.derived(() =>
          String(index.get() + 1).padStart(2, '0')
        );
        const indicator = Cell.derived(() => (isActive.get() ? '▶ ' : '  '));
        const prefix = Cell.derived(
          () => `${indicator.get()}${position.get()}. `
        );

        return (
          <box
            width="100%"
            justifyContent="space-between"
            onMouseDown={handleMouseDown}
          >
            <box flexDirection="row">
              <text fg={fg} attributes={attributes} content={prefix} />
              <text fg={fg} attributes={attributes} content={track.title} />
            </box>
            <text
              fg="gray"
              attributes={artistAttributes}
              content={track.artist}
            />
          </box>
        );
      })}
    </box>
  );
}

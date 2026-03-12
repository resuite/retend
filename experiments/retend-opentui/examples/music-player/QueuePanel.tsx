import { TextAttributes } from '@opentui/core';

import { TrackList } from './TrackList';

export function QueuePanel() {
  return (
    <box width="100%" marginTop={2} flexDirection="column">
      <text fg="gray" attributes={TextAttributes.BOLD} marginBottom={1}>
        UP NEXT
      </text>
      <TrackList />
    </box>
  );
}

import { TextAttributes } from '@opentui/core';
import { Cell, For, Switch, type Cell as CellType } from 'retend';

import { meterColumns } from './constants';
import { useMusicPlayerScope } from './MusicPlayerScope';

interface MusicPlayerArtworkProps {
  marginBottom: CellType<number>;
  marginRight: CellType<number>;
  width: CellType<number | '100%'>;
}

export function MusicPlayerArtwork(props: MusicPlayerArtworkProps) {
  const { marginBottom, marginRight, width } = props;
  const { accent, currentIndex, currentTrack, isPlaying, meterTick } =
    useMusicPlayerScope();
  const meterRows = [4, 3, 2, 1, 0];
  const tag = Cell.derived(() => currentTrack.get().tag);

  return (
    <box
      width={width}
      flexDirection="column"
      marginRight={marginRight}
      marginBottom={marginBottom}
    >
      <box
        width="100%"
        height={9}
        borderColor={accent}
        borderStyle="single"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        {Switch(accent, {}, (col) => (
          <ascii_font text="MIX" font="pallet" color={col} />
        ))}
        <text fg={accent} attributes={TextAttributes.DIM} content={tag} />
      </box>
      <box width="100%" marginTop={1} height={6} flexDirection="column">
        {For(meterRows, (row) => (
          <box width="100%" flexDirection="row" justifyContent="space-between">
            {For(meterColumns, (column) => {
              const char = Cell.derived(() => {
                const seed =
                  meterTick.get() + column * 7 + currentIndex.get() * 11;
                const height =
                  ((Math.sin(seed / 5) + 1) * 2.5 + (column % 4)) | 0;
                const value = isPlaying.get() ? height : 1;
                if (value > row) return '█';
                return ' ';
              });

              return <text fg={accent} content={char} />;
            })}
          </box>
        ))}
      </box>
    </box>
  );
}

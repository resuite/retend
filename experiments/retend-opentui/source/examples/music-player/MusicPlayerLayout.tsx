import { type Renderable } from '@opentui/core';
import { type Cell as CellType } from 'retend';

import { MusicPlayerArtwork } from './MusicPlayerArtwork';
import { MusicPlayerHeader } from './MusicPlayerHeader';
import { NowPlayingPanel } from './NowPlayingPanel';

interface MusicPlayerLayoutProps {
  artMarginBottom: CellType<number>;
  artMarginRight: CellType<number>;
  artWidth: CellType<number | '100%'>;
  bodyDirection: CellType<'column' | 'row'>;
  controlsDirection: CellType<'column' | 'row'>;
  controlsMarginTop: CellType<number>;
  handleKeyDown: (key: { name: string }) => void;
  handleSizeChange: (this: Renderable) => void;
  headerDirection: CellType<'column' | 'row'>;
  infoWidth: CellType<number | '100%'>;
  rootRef: CellType<Renderable | null>;
  accent: CellType<string>;
}

export function MusicPlayerLayout(props: MusicPlayerLayoutProps) {
  const {
    accent,
    artMarginBottom,
    artMarginRight,
    artWidth,
    bodyDirection,
    controlsDirection,
    controlsMarginTop,
    handleKeyDown,
    handleSizeChange,
    headerDirection,
    infoWidth,
    rootRef,
  } = props;

  return (
    <box
      ref={rootRef}
      focusable
      onKeyDown={handleKeyDown}
      onSizeChange={handleSizeChange}
      width="92%"
      maxWidth={80}
      borderColor={accent}
      borderStyle="rounded"
      paddingX={3}
      paddingY={1}
      flexDirection="column"
    >
      <MusicPlayerHeader direction={headerDirection} />
      <box width="100%" flexDirection={bodyDirection} marginBottom={1}>
        <MusicPlayerArtwork
          width={artWidth}
          marginRight={artMarginRight}
          marginBottom={artMarginBottom}
        />
        <NowPlayingPanel
          width={infoWidth}
          controlsDirection={controlsDirection}
          controlsMarginTop={controlsMarginTop}
        />
      </box>
    </box>
  );
}

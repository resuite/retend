import { type Renderable } from '@opentui/core';
import { Cell, onSetup } from 'retend';

import { MusicPlayerLayout } from './MusicPlayerLayout';
import { MusicPlayerScope } from './MusicPlayerScope';
import { useMusicPlayer } from './useMusicPlayer';

export function MusicPlayer() {
  const rootRef = Cell.source<Renderable | null>(null);
  const playerWidth = Cell.source(80);
  const state = useMusicPlayer();
  const {
    currentIndex,
    currentTrack,
    decreaseVolume,
    elapsed,
    handleKeyDown,
    increaseVolume,
    isPlaying,
    nextTrack,
    previousTrack,
    selectTrack,
    tickPlayback,
    togglePlayback,
    volume,
  } = state;
  const meterTick = Cell.source(0);
  const accent = Cell.derived(() => currentTrack.get().accent);
  const isCompact = Cell.derived(() => playerWidth.get() < 74);
  const headerDirection = Cell.derived(() =>
    isCompact.get() ? 'column' : 'row'
  );
  const bodyDirection = Cell.derived(() =>
    isCompact.get() ? 'column' : 'row'
  );
  const controlsDirection = Cell.derived(() =>
    isCompact.get() ? 'column' : 'row'
  );
  const artWidth = Cell.derived(() => (isCompact.get() ? '100%' : 26));
  const artMarginRight = Cell.derived(() => (isCompact.get() ? 0 : 4));
  const artMarginBottom = Cell.derived(() => (isCompact.get() ? 1 : 0));
  const infoWidth = Cell.derived(() => (isCompact.get() ? '100%' : 44));
  const controlsMarginTop = Cell.derived(() => (isCompact.get() ? 1 : 0));
  const handleSizeChange = function (this: Renderable) {
    playerWidth.set(this.width);
  };

  onSetup(() => {
    const root = rootRef.get();
    if (root) root.focus();

    const playbackInterval = setInterval(() => {
      const root = rootRef.get();
      if (!root || root.isDestroyed) {
        clearInterval(playbackInterval);
        return;
      }
      tickPlayback();
    }, 1000);
    const meterInterval = setInterval(() => {
      const root = rootRef.get();
      if (!root || root.isDestroyed) {
        clearInterval(meterInterval);
        return;
      }
      meterTick.set(meterTick.get() + 1);
    }, 60);

    return () => {
      clearInterval(playbackInterval);
      clearInterval(meterInterval);
    };
  });

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center">
      <MusicPlayerScope.Provider
        value={{
          accent,
          currentIndex,
          currentTrack,
          decreaseVolume,
          elapsed,
          increaseVolume,
          isPlaying,
          meterTick,
          nextTrack,
          previousTrack,
          selectTrack,
          togglePlayback,
          volume,
        }}
      >
        <MusicPlayerLayout
          rootRef={rootRef}
          handleKeyDown={handleKeyDown}
          handleSizeChange={handleSizeChange}
          accent={accent}
          headerDirection={headerDirection}
          bodyDirection={bodyDirection}
          artWidth={artWidth}
          artMarginRight={artMarginRight}
          artMarginBottom={artMarginBottom}
          infoWidth={infoWidth}
          controlsDirection={controlsDirection}
          controlsMarginTop={controlsMarginTop}
        />
      </MusicPlayerScope.Provider>
    </box>
  );
}

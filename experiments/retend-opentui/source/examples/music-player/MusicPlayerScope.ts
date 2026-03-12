import { createScope, useScopeContext, type Cell } from 'retend';

import type { Track } from './types';

interface MusicPlayerContext {
  accent: Cell<string>;
  currentIndex: Cell<number>;
  currentTrack: Cell<Track>;
  decreaseVolume: () => void;
  elapsed: Cell<number>;
  increaseVolume: () => void;
  isPlaying: Cell<boolean>;
  meterTick: Cell<number>;
  nextTrack: () => void;
  previousTrack: () => void;
  selectTrack: (index: number) => void;
  togglePlayback: () => void;
  volume: Cell<number>;
}

export const MusicPlayerScope = createScope<MusicPlayerContext>('music-player');

export function useMusicPlayerScope() {
  return useScopeContext(MusicPlayerScope);
}

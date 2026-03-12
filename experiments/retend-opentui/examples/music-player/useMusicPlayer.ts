import { Cell } from 'retend';

import { tracks } from './constants';

export function useMusicPlayer() {
  const currentIndex = Cell.source(0);
  const isPlaying = Cell.source(true);
  const elapsed = Cell.source(38);
  const volume = Cell.source(72);
  const currentTrack = Cell.derived(() => tracks[currentIndex.get()]);

  const previousTrack = () => {
    const nextIndex = currentIndex.get() - 1;
    currentIndex.set(nextIndex < 0 ? tracks.length - 1 : nextIndex);
    elapsed.set(0);
    isPlaying.set(true);
  };

  const nextTrack = () => {
    const nextIndex = currentIndex.get() + 1;
    currentIndex.set(nextIndex >= tracks.length ? 0 : nextIndex);
    elapsed.set(0);
    isPlaying.set(true);
  };

  const togglePlayback = () => isPlaying.set(!isPlaying.get());

  const increaseVolume = () => {
    const nextVolume = volume.get() + 4;
    if (nextVolume > 100) {
      volume.set(100);
      return;
    }
    volume.set(nextVolume);
  };

  const decreaseVolume = () => {
    const nextVolume = volume.get() - 4;
    if (nextVolume < 0) {
      volume.set(0);
      return;
    }
    volume.set(nextVolume);
  };

  const selectTrack = (index: number) => {
    currentIndex.set(index);
    elapsed.set(0);
    isPlaying.set(true);
  };

  const tickPlayback = () => {
    if (!isPlaying.get()) return;

    const nextElapsed = elapsed.get() + 1;
    const trackDuration = currentTrack.get().duration;
    if (nextElapsed >= trackDuration) {
      nextTrack();
      return;
    }

    elapsed.set(nextElapsed);
  };

  const handleKeyDown = (key: { name: string }) => {
    const name = key.name;
    if (name === 'space') return togglePlayback();
    if (name === 'up' || name === 'k') return previousTrack();
    if (name === 'down' || name === 'j') return nextTrack();
    if (name === 'left' || name === 'h') return decreaseVolume();
    if (name === 'right' || name === 'l') return increaseVolume();
  };

  return {
    currentIndex,
    currentTrack,
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
    decreaseVolume,
  };
}

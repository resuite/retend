import type { Track } from './types';

export const progressWidth = 30;
export const meterWidth = 28;
export const meterColumns = Array.from(
  { length: meterWidth },
  (_, index) => index
);
export const tracks: Track[] = [
  {
    title: 'Midnight Transit',
    artist: 'Lumen Static',
    duration: 214,
    accent: 'cyan',
    tag: 'night drive',
  },
  {
    title: 'Signal Bloom',
    artist: 'Soft Relay',
    duration: 189,
    accent: 'yellow',
    tag: 'warm synth',
  },
  {
    title: 'Glass Harbor',
    artist: 'North Arcade',
    duration: 246,
    accent: 'brightBlue',
    tag: 'slow wave',
  },
  {
    title: 'Velvet Current',
    artist: 'After Static',
    duration: 205,
    accent: 'magenta',
    tag: 'late set',
  },
];

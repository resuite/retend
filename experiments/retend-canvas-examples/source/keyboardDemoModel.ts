import { Cell } from 'retend';
import {
  Length,
  type CanvasKeyboardEvent,
  type CanvasStyle,
} from 'retend-canvas-2d';

export const lastTeal = Cell.source('(click panel, then type)');
export const lastAmber = Cell.source('(click panel, then type)');
export const activePanel = Cell.source<'teal' | 'amber' | null>(null);

export type KeyStatusCell = typeof lastTeal;

export function recordKey(target: KeyStatusCell, label: string) {
  return (e: CanvasKeyboardEvent) => {
    const mods = [
      e.ctrlKey && 'ctrl',
      e.shiftKey && 'shift',
      e.altKey && 'alt',
      e.metaKey && 'meta',
    ]
      .filter(Boolean)
      .join('+');
    const modPrefix = mods ? `${mods}+` : '';
    target.set(
      `${label}: ${modPrefix}${e.key} (code ${e.code})${e.repeat ? ' repeat' : ''}`
    );
  };
}

export const keyboardDemoMainStyle: CanvasStyle = {
  width: Length.Vw(100),
  height: Length.Vh(100),
  backgroundColor: '#0a0a0a',
  color: '#fafafa',
  fontFamily: 'Outfit',
  fontSize: Length.Px(13),
};

export const keyboardTitleStyle: CanvasStyle = {
  translate: [Length.Px(48), Length.Px(56)],
  fontSize: Length.Px(40),
  fontWeight: 800,
  color: '#a855f7',
};

export const keyboardBlurbStyle: CanvasStyle = {
  translate: [Length.Px(48), Length.Px(112)],
  fontSize: Length.Px(14),
  color: '#888',
  width: Length.Px(520),
};

export const keyboardFootStyle: CanvasStyle = {
  translate: [Length.Px(48), Length.Px(430)],
  fontSize: Length.Px(12),
  color: '#555',
};

export const tealPanelBoxStyle: CanvasStyle = {
  translate: [Length.Px(48), Length.Px(160)],
  width: Length.Px(300),
  height: Length.Px(240),
  backgroundColor: '#0d9488',
  borderRadius: Length.Px(14),
};

export const tealPanelTitleStyle: CanvasStyle = {
  translate: [Length.Px(20), Length.Px(24)],
  fontSize: Length.Px(18),
  fontWeight: 700,
  color: '#042f2e',
};

export const tealPanelStatusStyle: CanvasStyle = {
  translate: [Length.Px(20), Length.Px(56)],
  fontSize: Length.Px(13),
  color: '#134e4a',
  width: Length.Px(260),
};

export const amberPanelBoxStyle: CanvasStyle = {
  translate: [Length.Px(380), Length.Px(160)],
  width: Length.Px(300),
  height: Length.Px(240),
  backgroundColor: '#d97706',
  borderRadius: Length.Px(14),
};

export const amberPanelTitleStyle: CanvasStyle = {
  translate: [Length.Px(20), Length.Px(24)],
  fontSize: Length.Px(18),
  fontWeight: 700,
  color: '#451a03',
};

export const amberPanelStatusStyle: CanvasStyle = {
  translate: [Length.Px(20), Length.Px(56)],
  fontSize: Length.Px(13),
  color: '#78350f',
  width: Length.Px(260),
};

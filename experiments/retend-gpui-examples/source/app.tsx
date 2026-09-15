import type { GpuiColor, GpuiTransitionEvent } from 'retend-gpui';

import { Cell } from 'retend';

const LIGHT_THEME: Record<'surface' | 'text', GpuiColor> = {
  surface: '#eef2ff',
  text: '#1e1b4b',
};

const DARK_THEME: Record<'surface' | 'text', GpuiColor> = {
  surface: '#1e1b4b',
  text: '#e0e7ff',
};

function HoverCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        transitionProperty: ['backgroundColor', 'color'],
        transitionDuration: '180ms',
        transitionTimingFunction: 'ease-out',
        hover: { backgroundColor: '#3b82f6', color: '#ffffff' },
        active: { backgroundColor: '#e11d48', color: '#ffe4e6' },
      }}
    >
      Hover and press this card
    </div>
  );
}

export default function App() {
  const dark = Cell.source(false);
  const log = Cell.source<string[]>([]);
  const surfaceColor = Cell.derived(() =>
    dark.get() ? DARK_THEME.surface : LIGHT_THEME.surface
  );
  const textColor = Cell.derived(() =>
    dark.get() ? DARK_THEME.text : LIGHT_THEME.text
  );
  const cornerRadius = Cell.derived(() => (dark.get() ? 24 : 8));
  const label = Cell.derived(() => (dark.get() ? 'Light theme' : 'Dark theme'));

  function addLog(message: string): void {
    log.set([...log.get(), message].slice(-8));
  }

  function onEvent(kind: string) {
    return (event: GpuiTransitionEvent) => {
      addLog(
        `${kind}: ${event.propertyName} (${event.elapsedTime.toFixed(2)}s)`
      );
    };
  }

  function handleToggle(): void {
    addLog(dark.get() ? 'light clicked' : 'dark clicked');
    dark.set(!dark.get());
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 32,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 24,
          backgroundColor: surfaceColor,
          color: textColor,
          borderRadius: cornerRadius,
          transitionProperty: ['backgroundColor', 'color', 'borderRadius'],
          transitionDuration: '450ms',
          transitionTimingFunction: 'ease-in-out',
        }}
        onTransitionRun={onEvent('run')}
        onTransitionStart={onEvent('start')}
        onTransitionEnd={onEvent('end')}
        onTransitionCancel={onEvent('cancel')}
      >
        <div style={{ fontSize: 18, fontWeight: 'bold' }}>
          Color transitions
        </div>
        <div style={{ fontSize: 13 }}>
          backgroundColor, color, and borderRadius share one transitionProperty
          list, so the surface, the corners, and the inherited text color
          animate together.
        </div>
      </div>

      <HoverCard />

      <button onClick={handleToggle}>{label}</button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          fontSize: 12,
          color: '#64748b',
        }}
      >
        {log}
      </div>
    </div>
  );
}

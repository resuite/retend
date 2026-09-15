import type { GpuiTransitionEvent } from 'retend-gpui';

import { Cell } from 'retend';

export default function App() {
  const expanded = Cell.source(false);
  const log = Cell.source<string[]>([]);
  const width = Cell.derived(() => (expanded.get() ? 240 : 120));
  const opacity = Cell.derived(() => (expanded.get() ? 1 : 0.4));
  const borderRadius = Cell.derived(() => (expanded.get() ? 16 : 4));
  const label = Cell.derived(() => (expanded.get() ? 'Collapse' : 'Expand'));

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
    addLog(expanded.get() ? 'collapse clicked' : 'expand clicked');
    expanded.set(!expanded.get());
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
      }}
    >
      <div
        style={{
          width,
          height: 80,
          opacity,
          backgroundColor: '#3b82f6',
          borderRadius,
          transitionProperty: ['width', 'opacity', 'borderRadius'],
          transitionDuration: '300ms',
          transitionDelay: '50ms',
          transitionTimingFunction: 'ease-out',
        }}
        onTransitionRun={onEvent('run')}
        onTransitionStart={onEvent('start')}
        onTransitionEnd={onEvent('end')}
        onTransitionCancel={onEvent('cancel')}
      />
      <button onClick={handleToggle}>{label}</button>
      <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        {log}
      </div>
    </div>
  );
}

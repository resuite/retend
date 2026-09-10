import type { GpuiElement } from 'retend-gpui';

import { Cell } from 'retend';

export function FocusSection() {
  const focusTarget = Cell.source<GpuiElement | null>(null);
  const focusIt = () => focusTarget.get()?.focus();
  const blurIt = () => focusTarget.get()?.blur();

  return (
    <div style={{ gap: 8 }}>
      <div>Focus (Tab and Shift+Tab move between the boxes)</div>
      <div
        ref={focusTarget}
        tabIndex={0}
        style={{ padding: 8, backgroundColor: '#e8f0fe' }}
      >
        Focusable box
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={focusIt}>Focus it</div>
        <div onClick={blurIt}>Blur it</div>
      </div>
    </div>
  );
}

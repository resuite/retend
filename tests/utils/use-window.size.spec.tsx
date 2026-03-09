import type { DOMRenderer } from 'retend-web';

import { runPendingSetupEffects, getActiveRenderer } from 'retend';
import { useWindowSize } from 'retend-utils/hooks';
import { describe, it, expect } from 'vitest';

import { browserSetup } from '../setup.tsx';

describe('Hooks (useWindowSize)', () => {
  browserSetup();

  it('should use window size', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const { width, height } = useWindowSize();
    await runPendingSetupEffects();
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);
  });

  it('should update window size', async () => {
    const { width, height } = useWindowSize();
    await runPendingSetupEffects();
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);
  });
});

import { describe, it, expect } from 'vitest';
import { getGlobalContext } from 'retend/context';
import { browserSetup } from '../setup.ts';
import { useWindowSize } from 'retend-utils/hooks';
import { runPendingSetupEffects } from 'retend';

describe('Hooks (useWindowSize)', () => {
  browserSetup();

  it('should use window size', async () => {
    const { window } = getGlobalContext();
    const { width, height } = useWindowSize();
    await runPendingSetupEffects();
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);
  });

  it('should update window size', async () => {
    const { width, height } = useWindowSize();
    await runPendingSetupEffects();
    const { window } = getGlobalContext() as { window: Window };
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);
  });
});

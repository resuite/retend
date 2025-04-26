import { describe, it, expect } from 'vitest';
import { getGlobalContext } from 'retend/context';
import { browserSetup } from '../setup.ts';
import { useWindowSize } from 'retend-utils/hooks';

declare global {
  interface Window {
    happyDOM: {
      setInnerWidth: (width: number) => void;
      setInnerHeight: (height: number) => void;
    };
  }
}

describe('Hooks (useWindowSize)', () => {
  browserSetup();

  it('should use window size', () => {
    const { window } = getGlobalContext();
    const { width, height } = useWindowSize();
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);
  });

  it('should update window size', () => {
    const { width, height } = useWindowSize();
    const { window } = getGlobalContext() as { window: Window };
    expect(width.get()).toBe(window.innerWidth);
    expect(height.get()).toBe(window.innerHeight);

    window.happyDOM.setInnerWidth(100);
    window.happyDOM.setInnerHeight(200);

    expect(width.get()).toBe(100);
    expect(height.get()).toBe(200);
  });
});

import { describe, it, expect } from 'vitest';
import { getGlobalContext } from 'retend/context';
import { vDomSetup } from '../setup.ts';
import { useWindowSize } from 'retend-utils/use-window-size';

const runTests = () => {
  it('should use window size', () => {
    const { window } = getGlobalContext();
    const { width, height } = useWindowSize();
    expect(width.value).toBe(window.innerWidth);
    expect(height.value).toBe(window.innerHeight);
  });
};

describe('Hooks (useWindowSize)', () => {
  vDomSetup();
  runTests();

  it('should update window size', () => {
    const { width, height } = useWindowSize();
    const { window } = getGlobalContext();
    expect(width.value).toBe(window.innerWidth);
    expect(height.value).toBe(window.innerHeight);

    window.innerWidth = 100;
    window.innerHeight = 200;

    expect(width.value).toBe(100);
    expect(height.value).toBe(200);
  });
});

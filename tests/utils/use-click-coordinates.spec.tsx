import { useClickCoordinates } from '../../packages/retend-utils/source/hooks/use-click-coordinates.js';
import { Cell } from 'retend';
import { describe, expect, it } from 'vitest';
import { vDomSetup, browserSetup } from '../setup';
import { getGlobalContext } from 'retend/context';

const runTests = () => {
  it('should return a Cell containing the click coordinates', () => {
    const { x, y } = useClickCoordinates();
    expect(x).toBeInstanceOf(Cell);
    expect(y).toBeInstanceOf(Cell);
    expect(x.get()).toBe(0);
    expect(y.get()).toBe(0);
  });
};

describe('useClickCoordinates', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    it('should update the coordinates on click', () => {
        const { window } = getGlobalContext();
        const { x, y } = useClickCoordinates();

        window.dispatchEvent(
            new MouseEvent('click', { clientX: 100, clientY: 200 })
        );

        expect(x.get()).toBe(100);
        expect(y.get()).toBe(200);
    });
});

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

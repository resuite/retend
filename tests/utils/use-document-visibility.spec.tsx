import { describe, it, expect } from 'vitest';
import { getGlobalContext } from 'retend/context';
import { browserSetup } from '../setup.ts';
import { useDocumentVisibility } from '../../packages/retend-utils/source/hooks';

describe('useDocumentVisibility', () => {
  browserSetup();

  it('should return the initial document visibility state', () => {
    const visibility = useDocumentVisibility();
    expect(visibility.get()).toBe('visible');
  });

  it('should update the visibility state when the visibilitychange event is fired', () => {
    const { window } = getGlobalContext();
    const visibility = useDocumentVisibility();

    // Simulate the visibility state changing to hidden
    Object.defineProperty(window.document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    window.document.dispatchEvent(new Event('visibilitychange'));

    expect(visibility.get()).toBe('hidden');

    // Simulate the visibility state changing back to visible
    Object.defineProperty(window.document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    window.document.dispatchEvent(new Event('visibilitychange'));

    expect(visibility.get()).toBe('visible');
  });
});

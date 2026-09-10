import { afterEach, describe, expect, it } from 'vitest';

import {
  clearAppContext,
  setAppContext,
  useAppContext,
} from '../source/application';

afterEach(() => clearAppContext());

describe('GPUI application context', () => {
  it('preserves the configured context identity while the application is active', () => {
    const context = { value: 1 };
    setAppContext(context);
    expect(useAppContext()).toBe(context);
  });

  it('fails outside the application lifecycle', () => {
    clearAppContext();
    expect(() => useAppContext()).toThrow('active GPUI application');
  });
});

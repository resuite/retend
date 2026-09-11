import { beforeEach, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  exists: vi.fn(() => true),
  require: vi.fn(),
}));

vi.mock('node:fs', () => ({ default: { existsSync: native.exists } }));
vi.mock('node:module', () => ({ createRequire: () => native.require }));

beforeEach(() => {
  vi.resetModules();
  native.exists.mockReset().mockReturnValue(true);
  native.require.mockReset();
});

it('resolves a successfully loaded addon only once', async () => {
  const addon = { tick: vi.fn() };
  native.require.mockReturnValue(addon);
  const { loadNativeAddon } = await import('../source/native/addon');
  expect(loadNativeAddon()).toBe(addon);
  expect(loadNativeAddon()).toBe(addon);
  expect(native.exists).toHaveBeenCalledOnce();
  expect(native.require).toHaveBeenCalledOnce();
});

it('does not cache a failed load', async () => {
  const addon = { tick: vi.fn() };
  native.require
    .mockImplementationOnce(() => {
      throw new Error('load failed');
    })
    .mockReturnValue(addon);
  const { loadNativeAddon } = await import('../source/native/addon');
  expect(() => loadNativeAddon()).toThrow('load failed');
  expect(loadNativeAddon()).toBe(addon);
  expect(native.require).toHaveBeenCalledTimes(2);
});

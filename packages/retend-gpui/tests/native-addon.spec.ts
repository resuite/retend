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

it('resolves a successfully loaded workspace addon only once', async () => {
  const addon = { startEventPump: vi.fn(), stopEventPump: vi.fn() };
  native.require.mockReturnValue(addon);
  const { loadNativeAddon } = await import('../source/native/addon');
  expect(loadNativeAddon()).toBe(addon);
  expect(loadNativeAddon()).toBe(addon);
  expect(native.exists).toHaveBeenCalledOnce();
  expect(native.require).toHaveBeenCalledOnce();
  expect(String(native.require.mock.calls[0]?.[0])).toContain(
    `native/npm/${process.platform}-${process.arch}/retend-gpui-native.${process.platform}-${process.arch}.node`
  );
});

it('loads the matching platform package when no workspace addon exists', async () => {
  const addon = { startEventPump: vi.fn(), stopEventPump: vi.fn() };
  const target = `${process.platform}-${process.arch}`;
  native.exists.mockReturnValue(false);
  native.require.mockReturnValue(addon);

  const { loadNativeAddon } = await import('../source/native/addon');
  expect(loadNativeAddon()).toBe(addon);
  expect(native.require).toHaveBeenCalledWith(`retend-gpui-native-${target}`);
});

it('reports a useful error when the matching platform package is missing', async () => {
  const target = `${process.platform}-${process.arch}`;
  const packageName = `retend-gpui-native-${target}`;
  const missing = Object.assign(
    new Error(`Cannot find module '${packageName}'`),
    { code: 'MODULE_NOT_FOUND' }
  );
  native.exists.mockReturnValue(false);
  native.require.mockImplementation(() => {
    throw missing;
  });

  const { loadNativeAddon } = await import('../source/native/addon');
  expect(() => loadNativeAddon()).toThrow(
    `Retend GPUI native binary is missing for ${target}`
  );
});

it('reports a useful error when the platform package is present but its binary is missing', async () => {
  const target = `${process.platform}-${process.arch}`;
  const missing = Object.assign(
    new Error(
      `Cannot find module '/some/path/retend-gpui-native.${target}.node'`
    ),
    { code: 'MODULE_NOT_FOUND' }
  );
  native.exists.mockReturnValue(false);
  native.require.mockImplementation(() => {
    throw missing;
  });

  const { loadNativeAddon } = await import('../source/native/addon');
  expect(() => loadNativeAddon()).toThrow(
    `Retend GPUI native binary is missing for ${target}`
  );
});

it('names the supported targets when the platform is unsupported', async () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', {
    value: 'sunos',
    configurable: true,
  });
  try {
    native.exists.mockReturnValue(false);
    const { loadNativeAddon } = await import('../source/native/addon');
    expect(() => loadNativeAddon()).toThrow(
      `Retend GPUI does not support native target sunos-${process.arch}. Supported targets are darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-arm64, win32-x64.`
    );
  } finally {
    Object.defineProperty(process, 'platform', platform);
  }
});

it('does not cache a failed workspace load', async () => {
  const addon = { startEventPump: vi.fn(), stopEventPump: vi.fn() };
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

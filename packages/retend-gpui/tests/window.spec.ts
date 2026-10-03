import { describe, expect, it, vi } from 'vitest';

import type { RetendGpuiRenderer } from '../source/gpui-renderer';
import type { GpuiWindowHandle, GpuiWindowOptions } from '../source/window';

import { RuntimeGpuiWindow } from '../source/window';

class TestWindowHandle extends EventTarget implements GpuiWindowHandle {
  readonly close = vi.fn(() => this.dispatchEvent(new Event('close')));
}

function createWindow(
  open: (options?: GpuiWindowOptions) => Promise<GpuiWindowHandle> = async () =>
    new TestWindowHandle(),
  setWindowTitle = vi.fn(),
  title = 'Parent'
): RuntimeGpuiWindow {
  const renderer = {
    host: Object.assign(new EventTarget(), { setWindowTitle }),
  } as unknown as RetendGpuiRenderer;
  return new RuntimeGpuiWindow(title, 800, 600, renderer, {
    close() {},
    open,
  });
}

describe('GPUI runtime window', () => {
  it('tracks native size and focus while keeping title writable', () => {
    const setTitle = vi.fn();
    const runtimeWindow = createWindow(undefined, setTitle, 'Initial');
    const focus = vi.fn();
    const blur = vi.fn();
    runtimeWindow.addEventListener('focus', focus);
    runtimeWindow.addEventListener('blur', blur);

    expect(runtimeWindow.width.get()).toBe(800);
    expect(runtimeWindow.height.get()).toBe(600);

    runtimeWindow.width.set(1024);
    runtimeWindow.height.set(720);
    expect(runtimeWindow.width.get()).toBe(1024);
    expect(runtimeWindow.height.get()).toBe(720);

    runtimeWindow.dispatchEvent(new Event('focus'));
    runtimeWindow.dispatchEvent(new Event('blur'));
    expect(focus).toHaveBeenCalledOnce();
    expect(blur).toHaveBeenCalledOnce();

    runtimeWindow.title.set('Updated');
    expect(setTitle).toHaveBeenCalledWith('Updated');
    runtimeWindow.dispose();
  });

  it('closes owned child windows with their opener but leaves detached windows alive', async () => {
    const owned = new TestWindowHandle();
    const detached = new TestWindowHandle();
    const open = vi
      .fn()
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce(detached);
    const runtimeWindow = createWindow(open);

    await runtimeWindow.open();
    await runtimeWindow.open({ closeWithOpener: false });
    runtimeWindow.dispose();

    expect(owned.close).toHaveBeenCalledOnce();
    expect(detached.close).not.toHaveBeenCalled();
  });

  it('closes and rejects an owned child that finishes opening after its opener closes', async () => {
    const child = new TestWindowHandle();
    let resolve!: (handle: GpuiWindowHandle) => void;
    const open = new Promise<GpuiWindowHandle>((done) => {
      resolve = done;
    });
    const runtimeWindow = createWindow(() => open);

    const pending = runtimeWindow.open();
    runtimeWindow.dispose();
    resolve(child);

    await expect(pending).rejects.toThrow('opener closed');
    expect(child.close).toHaveBeenCalledOnce();
  });

  it('rejects opening from a window that is already closed', async () => {
    const open = vi.fn(async () => new TestWindowHandle());
    const runtimeWindow = createWindow(open);
    runtimeWindow.dispose();

    await expect(runtimeWindow.open()).rejects.toThrow('closed GPUI window');
    expect(open).not.toHaveBeenCalled();
  });
});

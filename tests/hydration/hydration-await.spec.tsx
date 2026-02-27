import { Await, Cell, For, If, Switch } from 'retend';
import type { JSX } from 'retend/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserSetup, timeout } from '../setup.tsx';
import {
  createHydrationClientRenderer,
  renderHydrationServerHtml,
  setupHydration as setupHydrationHelper,
  startHydration,
} from './hydration-helpers.tsx';

type TemplateFn = () => JSX.Template;

const setupAwaitHydration = (templateFn: TemplateFn) =>
  setupHydrationHelper(templateFn, true);

const getHydrationErrors = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((call) => String(call[0]).includes('Hydration error'));

describe('Hydration Await', () => {
  browserSetup();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates server-resolved Await content without showing fallback', async () => {
    const name = Cell.source('Ada');

    const template = () => {
      const greeting = Cell.derivedAsync(async (get) => {
        const value = get(name);
        await timeout(20);
        return `Hello ${value}`;
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <p id="await-text">{greeting}</p>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#await-text')?.textContent).toBe(
        'Hello Ada'
      );

      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelector('#await-text')?.textContent).toBe(
        'Hello Ada'
      );

      name.set('Lin');
      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelector('#await-text')?.textContent).toBe(
        'Hello Lin'
      );

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

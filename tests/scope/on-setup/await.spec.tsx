import {
  Await,
  Cell,
  getActiveRenderer,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup, getTextContent, timeout } from '../../setup.tsx';

describe('onSetup with Await', () => {
  browserSetup();

  it('runs setup only after Await resolves', async () => {
    const setupFn = vi.fn();

    const Child = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(30);
        return 'Ready';
      });

      onSetup(() => {
        setupFn();
      });

      return <span>{asyncText}</span>;
    };

    const App = () => (
      <div>
        <Await fallback={<span>Loading</span>}>
          <Child />
        </Await>
      </div>
    );

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);

    await runPendingSetupEffects();

    expect(getTextContent(result)).toBe('Loading');
    expect(setupFn).not.toHaveBeenCalled();

    await timeout(40);

    expect(getTextContent(result)).toBe('Ready');
    expect(setupFn).toHaveBeenCalledTimes(1);
  });

  it('activates setup only after all content is committed', async () => {
    const setupFn = vi.fn();
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    let contentWhenSetupRan: string | null = null;
    let result!: HTMLElement;

    const first = Cell.derivedAsync(async () => {
      await new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      return 'First';
    });
    const second = Cell.derivedAsync(async () => {
      await new Promise<void>((resolve) => {
        resolveSecond = resolve;
      });
      return 'Second';
    });
    const Child = () => {
      onSetup(() => {
        contentWhenSetupRan = getTextContent(result);
        setupFn();
      });
      return (
        <span>
          {first} {second}
        </span>
      );
    };
    const App = () => (
      <div>
        <Await fallback={<span>Loading</span>}>
          <Child />
        </Await>
      </div>
    );

    const renderer = getActiveRenderer();
    result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(getTextContent(result)).toBe('Loading');
    expect(setupFn).not.toHaveBeenCalled();

    resolveFirst();
    await timeout();
    expect(getTextContent(result)).toBe('Loading');
    expect(setupFn).not.toHaveBeenCalled();

    resolveSecond();
    await timeout();
    await timeout();

    expect(getTextContent(result)).toBe('First Second');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(contentWhenSetupRan).toBe('First Second');
  });

  it('registers cleanup only after Await resolves', async () => {
    const cleanupFn = vi.fn();
    const setupFn = vi.fn(() => cleanupFn);

    const Child = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(30);
        return 'Ready';
      });

      onSetup(setupFn);

      return <span>{asyncText}</span>;
    };

    const App = () => (
      <div>
        <Await fallback={<span>Loading</span>}>
          <Child />
        </Await>
      </div>
    );

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);

    await runPendingSetupEffects();

    expect(setupFn).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();

    await timeout(40);

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();
  });
});

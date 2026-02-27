import { Await, Cell, For, If, Switch } from 'retend';
import type { JSX } from 'retend/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserSetup, timeout } from '../setup.tsx';
import { setupHydration } from './hydration-helpers.tsx';

type TemplateFn = () => JSX.Template;

const setupAwaitHydration = (templateFn: TemplateFn) =>
  setupHydration(templateFn, true);

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

  it('shows server-resolved content immediately after hydration', async () => {
    const template = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(20);
        return 'Loaded';
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <p id="await-text">{asyncText}</p>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { html, document } = await setupAwaitHydration(template);
      console.log('=== PASSING TEST SERVER HTML ===');
      console.log(html);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#await-text')?.textContent).toBe('Loaded');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('shows all server-resolved content when multiple async children resolve', async () => {
    const template = () => {
      const first = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'First';
      });
      const second = Cell.derivedAsync(async () => {
        await timeout(25);
        return 'Second';
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <p id="first">{first}</p>
            <p id="second">{second}</p>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#first')?.textContent).toBe('First');
      expect(document.querySelector('#second')?.textContent).toBe('Second');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles nested Await boundaries with server-resolved content', async () => {
    const template = () => {
      const outerText = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'Outer';
      });
      const innerText = Cell.derivedAsync(async () => {
        await timeout(25);
        return 'Inner';
      });

      return (
        <div>
          <Await fallback={<span id="outer-fallback">Outer Loading</span>}>
            <span id="outer">{outerText}</span>
            <Await fallback={<span id="inner-fallback">Inner Loading</span>}>
              <span id="inner">{innerText}</span>
            </Await>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#outer-fallback')).toBeNull();
      expect(document.querySelector('#inner-fallback')).toBeNull();
      expect(document.querySelector('#outer')?.textContent).toBe('Outer');
      expect(document.querySelector('#inner')?.textContent).toBe('Inner');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles multiple sibling Await boundaries with server-resolved content', async () => {
    const template = () => {
      const first = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'First';
      });
      const second = Cell.derivedAsync(async () => {
        await timeout(25);
        return 'Second';
      });

      return (
        <div>
          <Await fallback={<span id="fallback-a">Loading A</span>}>
            <span id="text-a">{first}</span>
          </Await>
          <span id="separator">|</span>
          <Await fallback={<span id="fallback-b">Loading B</span>}>
            <span id="text-b">{second}</span>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#fallback-a')).toBeNull();
      expect(document.querySelector('#fallback-b')).toBeNull();
      expect(document.querySelector('#text-a')?.textContent).toBe('First');
      expect(document.querySelector('#text-b')?.textContent).toBe('Second');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles async For lists within Await with server-resolved content', async () => {
    const template = () => {
      const items = Cell.derivedAsync(async () => {
        await timeout(10);
        return ['A', 'B', 'C'];
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <div id="list">
              {For(items, (item) => (
                <span class="item">{item}</span>
              ))}
            </div>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      const itemElements = document.querySelectorAll('.item');
      expect(itemElements.length).toBe(3);
      expect(itemElements[0]?.textContent).toBe('A');
      expect(itemElements[1]?.textContent).toBe('B');
      expect(itemElements[2]?.textContent).toBe('C');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles async content created inside component body during hydration', async () => {
    const template = () => {
      const App = () => {
        const asyncText = Cell.derivedAsync(async () => {
          await timeout(20);
          return 'Inner';
        });

        return (
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <div id="content">{asyncText}</div>
          </Await>
        );
      };

      return <App />;
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#content')?.textContent).toBe('Inner');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles If conditions within Await during hydration', async () => {
    const template = () => {
      const condition = Cell.derivedAsync(async () => {
        await timeout(10);
        return true;
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            {If(
              condition,
              () => (
                <span id="yes">Yes</span>
              ),
              () => (
                <span id="no">No</span>
              )
            )}
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { html } = await setupAwaitHydration(template);
      console.log('=== If TEST SERVER HTML ===');
      console.log(html);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#yes')?.textContent).toBe('Yes');
      expect(document.querySelector('#no')).toBeNull();

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles Switch cases within Await during hydration', async () => {
    const template = () => {
      const status = Cell.source('loading');
      const message = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'Loaded';
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            {Switch(status, {
              loading: () => <span id="loading">{message}</span>,
              done: () => <span id="done">Done</span>,
            })}
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#loading')?.textContent).toBe('Loaded');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('updates correctly when reactive cells change after hydration', async () => {
    const trigger = Cell.source('First');

    const template = () => {
      const asyncText = Cell.derivedAsync(async (get) => {
        const value = get(trigger);
        await timeout(10);
        return value;
      });

      return (
        <div>
          <Await fallback={<span id="await-fallback">Loading</span>}>
            <p id="await-text">{asyncText}</p>
          </Await>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupAwaitHydration(template);

      expect(document.querySelector('#await-fallback')).toBeNull();
      expect(document.querySelector('#await-text')?.textContent).toBe('First');

      trigger.set('Second');

      await vi.advanceTimersByTimeAsync(20);
      expect(document.querySelector('#await-text')?.textContent).toBe('Second');

      expect(getHydrationErrors(errorSpy).length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

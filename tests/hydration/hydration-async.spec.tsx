import { Cell, For, If, Switch } from 'retend';
import type { JSX } from 'retend/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHydrationClientRenderer,
  renderHydrationServerHtml,
  startHydration,
} from './hydration-helpers.tsx';
import { browserSetup, timeout } from '../setup.tsx';

const setupServerRender = async (templateFn: () => JSX.Template) => {
  return renderHydrationServerHtml(templateFn, {
    wrapInAwait: true,
    waitForAwaitBoundaries: true,
  });
};

const setupHydration = async (templateFn: () => JSX.Template) => {
  const html = await renderHydrationServerHtml(templateFn, {
    wrapInAwait: true,
    waitForAwaitBoundaries: true,
  });
  const { renderer: clientRenderer, document } =
    createHydrationClientRenderer(html);
  startHydration(clientRenderer, templateFn, { renderInHydrationBranch: true });
  await clientRenderer.endHydration();

  return {
    html,
    document,
  };
};

const getCommentNodes = (root: Node) => {
  const owner = root.ownerDocument ?? (root as Document);
  const walker = owner.createTreeWalker(root, 128);
  const comments: Comment[] = [];
  let cursor = walker.nextNode();
  while (cursor) {
    comments.push(cursor as Comment);
    cursor = walker.nextNode();
  }
  return comments;
};

const findTextNode = (parent: Node, content: string) => {
  return Array.from(parent.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent === content
  );
};

describe('Hydration async', () => {
  browserSetup();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serializes unresolved control-flow ranges with explicit open/close comment markers', async () => {
    const gate = Cell.source(true);
    const mode = Cell.source<'idle' | 'done'>('idle');
    const items = Cell.source(['A', 'B']);

    const template = () => {
      const asyncGate = Cell.derivedAsync(async (get) => {
        const value = get(gate);
        await timeout(20);
        return value;
      });

      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      const asyncMode = Cell.derivedAsync(async (get) => {
        const value = get(mode);
        await timeout(20);
        return value;
      });

      return (
        <div id="cf-root">
          <div id="cf-if">
            {If(asyncGate, {
              true: () => <span>Visible</span>,
              false: () => <span>Hidden</span>,
            })}
          </div>
          <div id="cf-for">
            {For(asyncItems, (item) => (
              <span>{item}</span>
            ))}
          </div>
          <div id="cf-switch">
            {Switch(asyncMode, {
              idle: () => <span>Idle</span>,
              done: () => <span>Done</span>,
            })}
          </div>
        </div>
      );
    };

    const html = await setupServerRender(template);

    const openCount = (html.match(/<!--\[-->/g) ?? []).length;
    const closeCount = (html.match(/<!--\]-->/g) ?? []).length;

    expect(openCount).toBeGreaterThanOrEqual(3);
    expect(closeCount).toBe(openCount);
  });

  it('skips static serialized range content when live async control-flow range is still pending', async () => {
    const show = Cell.source(true);
    const template = () => {
      const liveShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(20);
        return value;
      });

      return (
        <div id="range-root">
          <span id="range-before">Before</span>
          <div id="range-container">
            {If(liveShow, {
              true: () => <span id="range-payload">Payload</span>,
              false: () => <span id="range-empty">Empty</span>,
            })}
          </div>
          <span id="range-after">After</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const container = document.querySelector('#range-container');
      const openComment = Array.from(container?.childNodes ?? []).find(
        (node) =>
          node.nodeType === Node.COMMENT_NODE && node.textContent === '['
      );
      const closeComment = Array.from(container?.childNodes ?? []).find(
        (node) =>
          node.nodeType === Node.COMMENT_NODE && node.textContent === ']'
      );

      expect(container).not.toBeNull();
      expect(document.querySelector('#range-payload')?.textContent).toBe(
        'Payload'
      );
      expect(openComment).not.toBeUndefined();
      expect(closeComment).not.toBeUndefined();

      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelectorAll('#range-payload').length).toBe(1);
      expect(document.querySelector('#range-empty')).toBeNull();

      show.set(false);
      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelector('#range-payload')).toBeNull();
      expect(document.querySelector('#range-empty')?.textContent).toBe('Empty');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps interactive siblings working while an earlier async control-flow range is unresolved', async () => {
    const show = Cell.source(true);
    const clicks = Cell.source(0);

    const template = () => {
      const liveShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(40);
        return value;
      });

      return (
        <div id="pending-before-interactive">
          {If(liveShow, {
            true: () => <span id="pending-before-content">Pending Block</span>,
            false: () => <span id="pending-before-empty">Empty Block</span>,
          })}
          <button
            id="pending-before-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            +
          </button>
          <span id="pending-before-count">{clicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector(
        '#pending-before-btn'
      ) as HTMLButtonElement | null;
      const count = document.querySelector('#pending-before-count');

      expect(button).not.toBeNull();
      expect(count?.textContent).toBe('0');
      expect(document.querySelector('#pending-before-content')).not.toBeNull();

      button?.click();
      button?.click();
      expect(count?.textContent).toBe('2');

      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#pending-before-content')).not.toBeNull();

      show.set(false);
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#pending-before-content')).toBeNull();
      expect(document.querySelector('#pending-before-empty')).not.toBeNull();

      button?.click();
      expect(count?.textContent).toBe('3');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('allows nested client interaction while nested async control flow remains pending', async () => {
    const show = Cell.source(true);
    const clicks = Cell.source(0);

    const template = () => {
      const liveShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(40);
        return value;
      });

      return (
        <div id="nested-interaction-root">
          <article id="nested-shell">
            <header id="nested-header">
              <button
                id="nested-interaction-btn"
                type="button"
                onClick={() => clicks.set(clicks.get() + 1)}
              >
                Tap
              </button>
              <span id="nested-interaction-count">{clicks}</span>
            </header>
            <section id="nested-pending-container">
              <div id="nested-pending-inner">
                {If(liveShow, {
                  true: () => <p id="nested-pending-content">Server Content</p>,
                  false: () => <p id="nested-pending-empty">Client Empty</p>,
                })}
              </div>
            </section>
          </article>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector(
        '#nested-interaction-btn'
      ) as HTMLButtonElement | null;
      const count = document.querySelector('#nested-interaction-count');

      expect(button).not.toBeNull();
      expect(count?.textContent).toBe('0');
      expect(document.querySelector('#nested-pending-content')).not.toBeNull();

      button?.click();
      expect(count?.textContent).toBe('1');

      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#nested-pending-content')).not.toBeNull();

      show.set(false);
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#nested-pending-content')).toBeNull();
      expect(document.querySelector('#nested-pending-empty')).not.toBeNull();

      button?.click();
      expect(count?.textContent).toBe('2');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps sibling interactivity when async root If wraps nested For and If', async () => {
    const show = Cell.source(true);
    const nestedGate = Cell.source(true);
    const items = Cell.source(['A', 'B']);
    const clicks = Cell.source(0);

    const template = () => {
      const liveShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(40);
        return value;
      });

      return (
        <div id="root-if-nested">
          {If(liveShow, {
            true: () => (
              <section id="root-if-content">
                <ul id="root-if-list">
                  {For(items, (item) => (
                    <li class="root-if-item">
                      {If(nestedGate, {
                        true: () => <span class="nested-true">{item}</span>,
                        false: () => <span class="nested-false">{item}</span>,
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            ),
            false: () => <p id="root-if-fallback">Closed</p>,
          })}
          <button
            id="root-if-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            click
          </button>
          <span id="root-if-count">{clicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector(
        '#root-if-btn'
      ) as HTMLButtonElement;
      const count = document.querySelector('#root-if-count');

      expect(document.querySelectorAll('.root-if-item').length).toBe(2);
      button.click();
      button.click();
      expect(count?.textContent).toBe('2');

      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelectorAll('.nested-true').length).toBe(2);

      show.set(false);
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#root-if-content')).toBeNull();
      expect(document.querySelector('#root-if-fallback')?.textContent).toBe(
        'Closed'
      );

      button.click();
      expect(count?.textContent).toBe('3');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps sibling input reactive while async root Switch with nested If is unresolved', async () => {
    const mode = Cell.source<'idle' | 'busy'>('idle');
    const gate = Cell.source(true);
    const value = Cell.source('A');

    const template = () => {
      const liveMode = Cell.derivedAsync(async (get) => {
        const current = get(mode);
        await timeout(40);
        return current;
      });

      return (
        <div id="root-switch-nested">
          {Switch(liveMode, {
            idle: () => (
              <section id="switch-idle-panel">
                {If(gate, {
                  true: () => <span id="switch-gate-on">{value}</span>,
                  false: () => <span id="switch-gate-off">off</span>,
                })}
              </section>
            ),
            busy: () => <section id="switch-busy-panel">busy</section>,
          })}
          <input
            id="switch-input"
            value={value}
            onInput={(event) =>
              value.set((event.target as HTMLInputElement).value)
            }
          />
          <p id="switch-mirror">{value}</p>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const input = document.querySelector('#switch-input') as HTMLInputElement;
      const mirror = document.querySelector('#switch-mirror');

      input.value = 'B';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(mirror?.textContent).toBe('B');

      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#switch-idle-panel')).not.toBeNull();
      expect(document.querySelector('#switch-gate-on')?.textContent).toBe('B');

      mode.set('busy');
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#switch-idle-panel')).toBeNull();
      expect(document.querySelector('#switch-busy-panel')?.textContent).toBe(
        'busy'
      );

      input.value = 'C';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(mirror?.textContent).toBe('C');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps sibling interactivity while async root For with nested If is unresolved', async () => {
    const items = Cell.source(['A', 'B']);
    const showBadge = Cell.source(true);
    const clicks = Cell.source(0);

    const template = () => {
      const liveItems = Cell.derivedAsync(async (get) => {
        const current = get(items);
        await timeout(40);
        return current;
      });

      return (
        <div id="root-for-nested">
          <ul id="root-for-list">
            {For(liveItems, (item) => (
              <li class="root-for-item">
                {If(showBadge, {
                  true: () => <span class="badge">{item}</span>,
                  false: () => <span class="plain">{item}</span>,
                })}
              </li>
            ))}
          </ul>
          <button
            id="root-for-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            +
          </button>
          <span id="root-for-count">{clicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector(
        '#root-for-btn'
      ) as HTMLButtonElement;
      const count = document.querySelector('#root-for-count');

      expect(document.querySelectorAll('.root-for-item').length).toBe(2);
      button.click();
      expect(count?.textContent).toBe('1');

      await vi.advanceTimersByTimeAsync(50);
      showBadge.set(false);
      expect(document.querySelectorAll('.plain').length).toBe(2);

      button.click();
      expect(count?.textContent).toBe('2');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles nested async ranges (root async If then async inner Switch) while sibling stays interactive', async () => {
    const showOuter = Cell.source(true);
    const innerMode = Cell.source<'alpha' | 'beta'>('alpha');
    const clicks = Cell.source(0);

    const template = () => {
      const liveOuter = Cell.derivedAsync(async (get) => {
        const value = get(showOuter);
        await timeout(20);
        return value;
      });
      const liveInner = Cell.derivedAsync(async (get) => {
        const value = get(innerMode);
        await timeout(70);
        return value;
      });

      return (
        <div id="double-async-root">
          {If(liveOuter, {
            true: () => (
              <section id="double-outer-panel">
                <div id="double-inner-panel">
                  {Switch(liveInner, {
                    alpha: () => <span id="double-alpha">Alpha</span>,
                    beta: () => <span id="double-beta">Beta</span>,
                  })}
                </div>
              </section>
            ),
            false: () => <p id="double-off">Off</p>,
          })}
          <button
            id="double-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            tap
          </button>
          <span id="double-count">{clicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector('#double-btn') as HTMLButtonElement;
      const count = document.querySelector('#double-count');

      button.click();
      expect(count?.textContent).toBe('1');

      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelector('#double-outer-panel')).not.toBeNull();
      button.click();
      expect(count?.textContent).toBe('2');

      await vi.advanceTimersByTimeAsync(60);
      innerMode.set('beta');
      await vi.advanceTimersByTimeAsync(80);
      expect(document.querySelector('#double-alpha')).toBeNull();
      expect(document.querySelector('#double-beta')?.textContent).toBe('Beta');

      showOuter.set(false);
      await vi.advanceTimersByTimeAsync(30);
      expect(document.querySelector('#double-outer-panel')).toBeNull();
      expect(document.querySelector('#double-off')?.textContent).toBe('Off');

      button.click();
      expect(count?.textContent).toBe('3');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('hydrates sibling deferred roots out of order while central interaction stays stable', async () => {
    const leftGate = Cell.source(true);
    const rightMode = Cell.source<'idle' | 'done'>('idle');
    const clicks = Cell.source(0);

    const template = () => {
      const liveLeft = Cell.derivedAsync(async (get) => {
        const value = get(leftGate);
        await timeout(90);
        return value;
      });
      const liveRight = Cell.derivedAsync(async (get) => {
        const value = get(rightMode);
        await timeout(30);
        return value;
      });

      return (
        <div id="out-of-order-root">
          <section id="out-of-order-left">
            {If(liveLeft, {
              true: () => <span id="left-on">Left On</span>,
              false: () => <span id="left-off">Left Off</span>,
            })}
          </section>
          <button
            id="out-of-order-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            +
          </button>
          <span id="out-of-order-count">{clicks}</span>
          <section id="out-of-order-right">
            {Switch(liveRight, {
              idle: () => <span id="right-idle">Idle</span>,
              done: () => <span id="right-done">Done</span>,
            })}
          </section>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector(
        '#out-of-order-btn'
      ) as HTMLButtonElement | null;
      const count = document.querySelector('#out-of-order-count');

      button?.click();
      button?.click();
      expect(count?.textContent).toBe('2');

      rightMode.set('done');
      leftGate.set(false);
      await vi.advanceTimersByTimeAsync(40);
      expect(document.querySelector('#right-done')?.textContent).toBe('Done');
      expect(document.querySelector('#left-on')).not.toBeNull();

      button?.click();
      expect(count?.textContent).toBe('3');

      await vi.advanceTimersByTimeAsync(70);
      expect(document.querySelector('#left-on')).toBeNull();
      expect(document.querySelector('#left-off')?.textContent).toBe('Left Off');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('applies queued state changes to deferred roots when they resolve at different times', async () => {
    const gate = Cell.source(true);
    const mode = Cell.source<'a' | 'b'>('a');
    const items = Cell.source(['x']);
    const clicks = Cell.source(0);

    const template = () => {
      const liveGate = Cell.derivedAsync(async (get) => {
        const value = get(gate);
        await timeout(100);
        return value;
      });
      const liveMode = Cell.derivedAsync(async (get) => {
        const value = get(mode);
        await timeout(30);
        return value;
      });
      const liveItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(60);
        return value;
      });

      return (
        <div id="queued-root">
          <div id="queued-gate">
            {If(liveGate, {
              true: () => <span id="queued-gate-true">Gate True</span>,
              false: () => <span id="queued-gate-false">Gate False</span>,
            })}
          </div>
          <div id="queued-mode">
            {Switch(liveMode, {
              a: () => <span id="queued-mode-a">A</span>,
              b: () => <span id="queued-mode-b">B</span>,
            })}
          </div>
          <ul id="queued-items">
            {For(liveItems, (item) => (
              <li class="queued-item">{item}</li>
            ))}
          </ul>
          <button
            id="queued-btn"
            type="button"
            onClick={() => clicks.set(clicks.get() + 1)}
          >
            tap
          </button>
          <span id="queued-count">{clicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const button = document.querySelector('#queued-btn') as HTMLButtonElement;
      const count = document.querySelector('#queued-count');

      mode.set('b');
      items.set(['x', 'y', 'z']);
      gate.set(false);
      button.click();
      expect(count?.textContent).toBe('1');

      await vi.advanceTimersByTimeAsync(35);
      expect(document.querySelector('#queued-mode-b')?.textContent).toBe('B');
      expect(document.querySelector('#queued-gate-true')).not.toBeNull();
      expect(document.querySelectorAll('.queued-item').length).toBe(1);

      await vi.advanceTimersByTimeAsync(40);
      expect(
        document.querySelectorAll('.queued-item').length
      ).toBeGreaterThanOrEqual(3);
      expect(document.querySelector('#queued-gate-true')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(40);
      expect(document.querySelector('#queued-gate-true')).toBeNull();
      expect(document.querySelector('#queued-gate-false')?.textContent).toBe(
        'Gate False'
      );

      button.click();
      expect(count?.textContent).toBe('2');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps outside interaction live while nested deferred boundaries resolve in staggered order', async () => {
    const outer = Cell.source(true);
    const innerMode = Cell.source<'alpha' | 'beta'>('alpha');
    const input = Cell.source('one');

    const template = () => {
      const liveOuter = Cell.derivedAsync(async (get) => {
        const value = get(outer);
        await timeout(40);
        return value;
      });
      const liveInnerMode = Cell.derivedAsync(async (get) => {
        const value = get(innerMode);
        await timeout(110);
        return value;
      });

      return (
        <div id="staggered-root">
          {If(liveOuter, {
            true: () => (
              <section id="staggered-outer">
                {Switch(liveInnerMode, {
                  alpha: () => <span id="staggered-alpha">Alpha</span>,
                  beta: () => <span id="staggered-beta">Beta</span>,
                })}
              </section>
            ),
            false: () => <p id="staggered-off">Off</p>,
          })}
          <input
            id="staggered-input"
            value={input}
            onInput={(event) =>
              input.set((event.target as HTMLInputElement).value)
            }
          />
          <p id="staggered-mirror">{input}</p>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const field = document.querySelector(
        '#staggered-input'
      ) as HTMLInputElement;
      const mirror = document.querySelector('#staggered-mirror');

      field.value = 'two';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      expect(mirror?.textContent).toBe('two');

      innerMode.set('beta');
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#staggered-outer')).not.toBeNull();

      field.value = 'three';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      expect(mirror?.textContent).toBe('three');

      await vi.advanceTimersByTimeAsync(80);
      expect(document.querySelector('#staggered-alpha')).toBeNull();
      expect(document.querySelector('#staggered-beta')?.textContent).toBe(
        'Beta'
      );

      outer.set(false);
      await vi.advanceTimersByTimeAsync(50);
      expect(document.querySelector('#staggered-outer')).toBeNull();
      expect(document.querySelector('#staggered-off')?.textContent).toBe('Off');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('activates interaction inside a deferred range only after its async root resolves', async () => {
    const gate = Cell.source(true);
    const insideClicks = Cell.source(0);
    const outsideClicks = Cell.source(0);

    const template = () => {
      const liveGate = Cell.derivedAsync(async (get) => {
        const value = get(gate);
        await timeout(70);
        return value;
      });

      return (
        <div id="inside-outside-root">
          {If(liveGate, {
            true: () => (
              <button
                id="inside-btn"
                type="button"
                onClick={() => insideClicks.set(insideClicks.get() + 1)}
              >
                inside
              </button>
            ),
            false: () => <span id="inside-off">off</span>,
          })}
          <button
            id="outside-btn"
            type="button"
            onClick={() => outsideClicks.set(outsideClicks.get() + 1)}
          >
            outside
          </button>
          <span id="inside-count">{insideClicks}</span>
          <span id="outside-count">{outsideClicks}</span>
        </div>
      );
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { document } = await setupHydration(template);
      const preHydrationInside = document.querySelector(
        '#inside-btn'
      ) as HTMLButtonElement | null;
      const outside = document.querySelector(
        '#outside-btn'
      ) as HTMLButtonElement;
      const insideCount = document.querySelector('#inside-count');
      const outsideCount = document.querySelector('#outside-count');

      preHydrationInside?.click();
      outside.click();
      expect(insideCount?.textContent).toBe('0');
      expect(outsideCount?.textContent).toBe('1');

      await vi.advanceTimersByTimeAsync(80);
      const hydratedInside = document.querySelector(
        '#inside-btn'
      ) as HTMLButtonElement | null;
      hydratedInside?.click();
      outside.click();
      expect(insideCount?.textContent).toBe('1');
      expect(outsideCount?.textContent).toBe('2');

      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(hydrationErrors.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('hydrates async text with server-resolved initial content and stays reactive', async () => {
    const name = Cell.source('Ada');

    const template = () => {
      const asyncText = Cell.derivedAsync(async (get) => {
        const value = get(name);
        await timeout(20);
        return `Hello ${value}`;
      });

      return <p id="async-text">{asyncText}</p>;
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-text');

    expect(node?.textContent).toBe('Hello Ada');

    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Hello Ada');

    name.set('Lin');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Hello Lin');
  });

  it('hydrates async text with static siblings from server output and stays in place', async () => {
    const name = Cell.source('Ada');

    const template = () => {
      const asyncText = Cell.derivedAsync(async (get) => {
        const value = get(name);
        await timeout(20);
        return value;
      });

      return <p id="async-mixed">Start-{asyncText}-End</p>;
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-mixed');
    const trailingStaticNode =
      node && findTextNode(node, '-End') ? findTextNode(node, '-End') : null;

    expect(node?.textContent).toBe('Start-Ada-End');
    expect(trailingStaticNode).not.toBeNull();

    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Start-Ada-End');
    expect(node && findTextNode(node, '-End')).toBe(trailingStaticNode);

    name.set('Lin');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Start-Lin-End');
    expect(node && findTextNode(node, '-End')).toBe(trailingStaticNode);
  });

  it('hydrates multiple async text nodes from resolved server output and keeps updates stable', async () => {
    const firstName = Cell.source('Ada');
    const lastName = Cell.source('Lovelace');

    const template = () => {
      const first = Cell.derivedAsync(async (get) => {
        const value = get(firstName);
        await timeout(10);
        return value;
      });
      const last = Cell.derivedAsync(async (get) => {
        const value = get(lastName);
        await timeout(30);
        return value;
      });

      return (
        <p id="async-multiple">
          {first}:{last}
        </p>
      );
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-multiple');
    const separator = node && findTextNode(node, ':');

    expect(node?.textContent).toBe('Ada:Lovelace');
    expect(separator).not.toBeNull();

    await vi.advanceTimersByTimeAsync(15);
    expect(node?.textContent).toBe('Ada:Lovelace');
    expect(node && findTextNode(node, ':')).toBe(separator);

    await vi.advanceTimersByTimeAsync(20);
    expect(node?.textContent).toBe('Ada:Lovelace');
    expect(node && findTextNode(node, ':')).toBe(separator);

    firstName.set('Lin');
    lastName.set('Torvalds');
    await vi.advanceTimersByTimeAsync(40);
    expect(node?.textContent).toBe('Lin:Torvalds');
    expect(node && findTextNode(node, ':')).toBe(separator);
  });

  it('hydrates async title attribute with server-resolved initial value', async () => {
    const name = Cell.source('Ada');

    const template = () => {
      const title = Cell.derivedAsync(async (get) => {
        const value = get(name);
        await timeout(20);
        return `User ${value}`;
      });

      return (
        <p id="async-title" title={title}>
          Profile
        </p>
      );
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-title');

    expect(node?.getAttribute('title')).toBe('User Ada');

    await vi.advanceTimersByTimeAsync(30);
    expect(node?.getAttribute('title')).toBe('User Ada');

    name.set('Lin');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.getAttribute('title')).toBe('User Lin');
  });

  it('hydrates async class attribute with server-resolved initial value', async () => {
    const mode = Cell.source('ready');

    const template = () => {
      const className = Cell.derivedAsync(async (get) => {
        const value = get(mode);
        await timeout(20);
        return `state-${value}`;
      });

      return (
        <p id="async-class" class={className}>
          Status
        </p>
      );
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-class');

    expect(node?.getAttribute('class')).toBe('state-ready');

    await vi.advanceTimersByTimeAsync(30);
    expect(node?.getAttribute('class')).toBe('state-ready');

    mode.set('done');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.getAttribute('class')).toBe('state-done');
  });

  it('hydrates pending async style value without Await', async () => {
    const color = Cell.source('red');

    const template = () => {
      const asyncColor = Cell.derivedAsync(async (get) => {
        const value = get(color);
        await timeout(20);
        return value;
      });

      return (
        <p id="async-style" style={{ color: asyncColor }}>
          Styled
        </p>
      );
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-style') as HTMLElement | null;

    expect(node?.style.color).toBe('');

    await vi.advanceTimersByTimeAsync(30);
    expect(node?.style.color).toBe('red');

    color.set('blue');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.style.color).toBe('blue');
  });

  it('hydrates async If nested in multiple containers with server-resolved initial branch', async () => {
    const show = Cell.source(true);

    const template = () => {
      const asyncShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(20);
        return value;
      });

      return (
        <div id="if-outer">
          <section id="if-middle">
            <div id="if-inner">
              {If(asyncShow, {
                true: () => <span id="if-true">Visible</span>,
                false: () => <span id="if-false">Hidden</span>,
              })}
            </div>
          </section>
        </div>
      );
    };

    const { document } = await setupHydration(template);

    expect(document.querySelector('#if-true')?.textContent).toBe('Visible');
    expect(document.querySelector('#if-false')).toBeNull();

    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelector('#if-true')?.textContent).toBe('Visible');
    expect(document.querySelector('#if-false')).toBeNull();

    show.set(false);
    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelector('#if-true')).toBeNull();
    expect(document.querySelector('#if-false')?.textContent).toBe('Hidden');
  });

  it('hydrates async For list nested in container hierarchy with server-resolved initial items', async () => {
    const items = Cell.source(['A', 'B']);

    const template = () => {
      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      return (
        <div id="for-outer">
          <article id="for-middle">
            <ul id="for-list">
              {For(asyncItems, (item) => (
                <li class="for-item">{item}</li>
              ))}
            </ul>
          </article>
        </div>
      );
    };

    const { document } = await setupHydration(template);

    expect(document.querySelectorAll('.for-item').length).toBe(2);

    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelectorAll('.for-item').length).toBe(2);
    expect(document.querySelector('.for-item')?.textContent).toBe('A');

    items.set(['A', 'B', 'C']);
    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelectorAll('.for-item').length).toBe(3);
    expect(document.querySelectorAll('.for-item')[2]?.textContent).toBe('C');
  });

  it('does not duplicate async For nodes on first client resolve when server list is already present', async () => {
    const items = Cell.source(['A', 'B']);

    const template = () => {
      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      return (
        <ul id="for-dedupe-same">
          {For(asyncItems, (item) => (
            <li class="for-dedupe-item">{item}</li>
          ))}
        </ul>
      );
    };

    const { document } = await setupHydration(template);
    const listTexts = () =>
      Array.from(document.querySelectorAll('.for-dedupe-item')).map(
        (node) => node.textContent
      );

    expect(listTexts()).toEqual(['A', 'B']);
    await vi.advanceTimersByTimeAsync(30);
    expect(listTexts()).toEqual(['A', 'B']);
  });

  it('does not duplicate async For nodes when list is reordered before first client resolve', async () => {
    const items = Cell.source(['A', 'B']);

    const template = () => {
      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      return (
        <ul id="for-dedupe-reorder">
          {For(asyncItems, (item) => (
            <li class="for-dedupe-reorder-item">{item}</li>
          ))}
        </ul>
      );
    };

    const { document } = await setupHydration(template);
    items.set(['B', 'A']);
    await vi.advanceTimersByTimeAsync(40);

    const texts = Array.from(
      document.querySelectorAll('.for-dedupe-reorder-item')
    ).map((node) => node.textContent);
    expect(texts).toEqual(['B', 'A']);
  });

  it('clears server-rendered async For nodes when first client resolve becomes empty', async () => {
    const items = Cell.source(['A', 'B']);

    const template = () => {
      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      return (
        <ul id="for-dedupe-empty">
          {For(asyncItems, (item) => (
            <li class="for-dedupe-empty-item">{item}</li>
          ))}
        </ul>
      );
    };

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.for-dedupe-empty-item').length).toBe(2);

    items.set([]);
    await vi.advanceTimersByTimeAsync(40);
    expect(document.querySelectorAll('.for-dedupe-empty-item').length).toBe(0);
  });

  it('never writes promise string values into text nodes during async updates', async () => {
    const name = Cell.source('Ada');

    const template = () => {
      const asyncText = Cell.derivedAsync(async (get) => {
        const value = get(name);
        await timeout(20);
        return `Hello ${value}`;
      });

      return <p id="async-text-rapid">{asyncText}</p>;
    };

    const { document } = await setupHydration(template);
    const node = document.querySelector('#async-text-rapid');

    expect(node?.textContent).toBe('Hello Ada');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Hello Ada');

    name.set('Lin');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent).toBe('Hello Lin');
    expect(node?.textContent?.includes('[object Promise]')).toBe(false);

    name.set('Ken');
    await vi.advanceTimersByTimeAsync(30);
    expect(node?.textContent?.includes('[object Promise]')).toBe(false);
    expect(node?.textContent).toBe('Hello Ken');
  });

  it('hydrates async Switch nested in multiple containers with server-resolved initial case', async () => {
    const mode = Cell.source<'idle' | 'done'>('idle');

    const template = () => {
      const asyncMode = Cell.derivedAsync(async (get) => {
        const value = get(mode);
        await timeout(20);
        return value;
      });

      return (
        <div id="switch-outer">
          <section id="switch-middle">
            <div id="switch-inner">
              {Switch(asyncMode, {
                idle: () => <span id="switch-idle">Idle</span>,
                done: () => <span id="switch-done">Done</span>,
              })}
            </div>
          </section>
        </div>
      );
    };

    const { document } = await setupHydration(template);
    const container = document.querySelector('#switch-inner');

    expect(document.querySelector('#switch-idle')?.textContent).toBe('Idle');
    expect(document.querySelector('#switch-done')).toBeNull();
    expect(container).not.toBeNull();
    const switchContainer = container as Element;
    const initialComments = getCommentNodes(switchContainer);
    expect(initialComments.some((node) => node.textContent === '[')).toBe(true);
    expect(initialComments.some((node) => node.textContent === ']')).toBe(true);

    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelector('#switch-idle')?.textContent).toBe('Idle');
    const children = Array.from(switchContainer.childNodes);
    const openIndex = children.findIndex(
      (node) => node.nodeType === Node.COMMENT_NODE && node.textContent === '['
    );
    const closeIndex = children.findIndex(
      (node) => node.nodeType === Node.COMMENT_NODE && node.textContent === ']'
    );
    const idleIndex = children.findIndex(
      (node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).id === 'switch-idle'
    );
    expect(openIndex).toBeGreaterThanOrEqual(0);
    expect(closeIndex).toBeGreaterThan(openIndex);
    expect(idleIndex).toBeGreaterThan(openIndex);
    expect(idleIndex).toBeLessThan(closeIndex);

    mode.set('done');
    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelector('#switch-idle')).toBeNull();
    expect(document.querySelector('#switch-done')?.textContent).toBe('Done');
  });

  it('hydrates nested async control flow (If containing For) inside wrappers with resolved server initial state', async () => {
    const show = Cell.source(true);
    const items = Cell.source(['X', 'Y']);

    const template = () => {
      const asyncShow = Cell.derivedAsync(async (get) => {
        const value = get(show);
        await timeout(10);
        return value;
      });

      const asyncItems = Cell.derivedAsync(async (get) => {
        const value = get(items);
        await timeout(20);
        return value;
      });

      return (
        <div id="nested-outer">
          <main id="nested-middle">
            <section id="nested-inner">
              {If(asyncShow, {
                true: () => (
                  <ul id="nested-list">
                    {For(asyncItems, (item) => (
                      <li class="nested-item">{item}</li>
                    ))}
                  </ul>
                ),
                false: () => <p id="nested-empty">Empty</p>,
              })}
            </section>
          </main>
        </div>
      );
    };

    const { document } = await setupHydration(template);

    expect(document.querySelector('#nested-list')).not.toBeNull();
    expect(document.querySelector('#nested-empty')).toBeNull();

    await vi.advanceTimersByTimeAsync(15);
    expect(document.querySelector('#nested-list')).not.toBeNull();
    expect(document.querySelectorAll('.nested-item').length).toBe(0);

    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelectorAll('.nested-item').length).toBe(2);

    items.set(['X', 'Y', 'Z']);
    await vi.advanceTimersByTimeAsync(30);
    expect(document.querySelectorAll('.nested-item').length).toBe(3);

    show.set(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelector('#nested-list')).toBeNull();
    expect(document.querySelector('#nested-empty')?.textContent).toBe('Empty');
  });
});

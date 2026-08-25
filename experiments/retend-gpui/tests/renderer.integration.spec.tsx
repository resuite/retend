import { TestGpuixRenderer, type EventPayload } from '@gpuix/native';
import {
  Await,
  Cell,
  For,
  If,
  createUnique,
  runPendingSetupEffects,
  setActiveRenderer,
  waitForAsyncBoundaries,
} from 'retend';
import { Router } from 'retend/router';
import { afterEach, describe, expect, it } from 'vitest';

import type { GpuiElement } from '../source/gpui-renderer';
import type { GpuiColor } from '../source/types';

import { RetendGpuiRenderer } from '../source/gpui-renderer';
import { hotReloadModule } from '../source/plugins/hmr';

const describeNative = describe.skipIf(process.platform !== 'darwin');

let activeRenderer: RetendGpuiRenderer | null = null;

interface RendererSetup {
  renderer: RetendGpuiRenderer;
  native: TestGpuixRenderer;
}

function createRenderer(): RendererSetup {
  const native = new TestGpuixRenderer();
  const renderer = new RetendGpuiRenderer(native);
  renderer.init();
  setActiveRenderer(renderer);
  activeRenderer = renderer;
  return { renderer, native };
}

afterEach(() => {
  activeRenderer?.dispose();
  activeRenderer = null;
});

describeNative('Retend GPUI native integration', () => {
  it('maintains window-local location and history state', () => {
    const { renderer } = createRenderer();
    renderer.host.resetLocation('/settings?tab=general#account');

    expect(renderer.host.location.pathname).toBe('/settings');
    expect(renderer.host.location.search).toBe('?tab=general');
    expect(renderer.host.location.hash).toBe('#account');

    renderer.host.history.pushState({ page: 2 }, '', '/projects/retend');
    expect(renderer.host.location.href).toBe('/projects/retend');
    expect(renderer.host.history.length).toBe(2);
    expect(renderer.host.history.state).toEqual({ page: 2 });

    let popstateCount = 0;
    renderer.host.addEventListener('popstate', () => popstateCount++);
    renderer.host.history.back();

    expect(renderer.host.location.href).toBe('/settings?tab=general#account');
    expect(popstateCount).toBe(1);
  });

  it('supports Retend Router navigation through the window host', async () => {
    const { renderer } = createRenderer();
    const router = new Router({
      routes: [
        { name: 'home', path: '/', component: () => 'Home' },
        { name: 'settings', path: '/settings', component: () => 'Settings' },
      ],
    });
    const detach = router.attachWindowListeners(
      renderer.host as unknown as Window
    );

    await router.navigate('/settings?tab=general#account');
    expect(renderer.host.location.href).toBe('/settings?tab=general#account');

    await router.replace('/');
    expect(renderer.host.location.href).toBe('/');
    expect(renderer.host.history.length).toBe(2);

    detach();
  });

  it('defaults the application root to a white canvas with black text', () => {
    const { renderer, native } = createRenderer();
    renderer.render(() => (
      <div>
        <text>plain text</text>
      </div>
    ));

    const tree = JSON.parse(native.getTreeJson());
    expect(tree.style).toMatchObject({
      backgroundColor: '#ffffff',
      color: '#000000',
    });
  });

  it('lays out unstyled divs at the containing block width', () => {
    const { renderer, native } = createRenderer();
    const outerRef = Cell.source<GpuiElement | null>(null);
    const innerRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => (
      <div ref={outerRef} style={{ width: 420 }}>
        <div ref={innerRef}>content</div>
      </div>
    ));
    renderer.flush();
    native.flush();

    const outer = outerRef.get();
    const inner = innerRef.get();
    if (!outer || !inner) throw new Error('Expected refs to resolve.');
    const outerBounds = native.getElementBounds(outer.id);
    const innerBounds = native.getElementBounds(inner.id);
    expect(innerBounds?.[2]).toBe(outerBounds?.[2]);
  });

  it('lays out unstyled text at its intrinsic inline width', () => {
    const { renderer, native } = createRenderer();
    const parentRef = Cell.source<GpuiElement | null>(null);
    const textRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => (
      <div ref={parentRef} style={{ width: 420 }}>
        <text ref={textRef}>short</text>
      </div>
    ));
    renderer.flush();
    native.flush();

    const parent = parentRef.get();
    const text = textRef.get();
    if (!parent || !text) throw new Error('Expected refs to resolve.');
    const parentBounds = native.getElementBounds(parent.id);
    const textBounds = native.getElementBounds(text.id);
    expect(textBounds?.[2]).toBeLessThan(parentBounds?.[2] ?? 0);
  });

  it('lays out adjacent unstyled text inline', () => {
    const { renderer, native } = createRenderer();
    const firstRef = Cell.source<GpuiElement | null>(null);
    const secondRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => (
      <div style={{ width: 420 }}>
        <text ref={firstRef}>first</text>
        <text ref={secondRef}>second</text>
      </div>
    ));
    renderer.flush();
    native.flush();

    const first = firstRef.get();
    const second = secondRef.get();
    if (!first || !second) throw new Error('Expected refs to resolve.');
    const firstBounds = native.getElementBounds(first.id);
    const secondBounds = native.getElementBounds(second.id);
    expect(secondBounds?.[0]).toBeGreaterThan(firstBounds?.[0] ?? 0);
    expect(secondBounds?.[1]).toBe(firstBounds?.[1]);
  });

  it('lets explicit root colors override the application defaults', () => {
    const { renderer, native } = createRenderer();
    renderer.render(() => (
      <div style={{ backgroundColor: '#112233', color: '#ddeeff' }}>
        <text>custom</text>
      </div>
    ));

    const tree = JSON.parse(native.getTreeJson());
    expect(tree.style).toMatchObject({
      backgroundColor: '#112233',
      color: '#ddeeff',
    });
  });

  it('renders and hot-reloads a root component through HMR boundaries', () => {
    const native = new TestGpuixRenderer();
    const renderer = new RetendGpuiRenderer(native, { hmr: true });
    renderer.init();
    setActiveRenderer(renderer);
    activeRenderer = renderer;

    function App() {
      return (
        <div>
          <text>before</text>
        </div>
      );
    }
    function NextApp() {
      return (
        <div>
          <text>after</text>
        </div>
      );
    }

    renderer.render(() => <App />);
    renderer.flush();
    expect(native.getAllText()).toEqual(['before']);

    hotReloadModule({ default: NextApp }, { default: App });
    renderer.flush();
    expect(native.getAllText()).toEqual(['after']);
  });

  it('rejects removing a rendered component export during HMR', () => {
    const native = new TestGpuixRenderer();
    const renderer = new RetendGpuiRenderer(native, { hmr: true });
    renderer.init();
    setActiveRenderer(renderer);
    activeRenderer = renderer;

    function App() {
      return <div>before</div>;
    }

    renderer.render(() => <App />);

    expect(() => hotReloadModule({}, { Panel: App })).toThrow(
      'replacement module no longer exports a component function'
    );
  });

  it('rejects replacing a rendered component export with a non-function', () => {
    const native = new TestGpuixRenderer();
    const renderer = new RetendGpuiRenderer(native, { hmr: true });
    renderer.init();
    setActiveRenderer(renderer);
    activeRenderer = renderer;

    function App() {
      return <div>before</div>;
    }

    renderer.render(() => <App />);

    expect(() => hotReloadModule({ Panel: 42 }, { Panel: App })).toThrow(
      'replacement module no longer exports a component function'
    );
  });

  it('shows and clears renderer-level development errors', () => {
    const { renderer, native } = createRenderer();
    renderer.render(() => <div>application</div>);

    renderer.showDevelopmentError(new Error('broken update'));
    expect(native.getAllText().join('')).toContain('broken update');

    renderer.clearDevelopmentError();
    expect(native.getAllText()).toEqual(['application']);
  });

  it('replaces nested If ranges and destroys abandoned native subtrees', async () => {
    const { renderer, native } = createRenderer();
    const outer = Cell.source(true);
    const inner = Cell.source(true);

    renderer.render(() => (
      <div>
        {If(outer, {
          true: () => (
            <div>
              outer:
              {If(inner, () => (
                <text>inner</text>
              ))}
            </div>
          ),
          false: () => <text>fallback</text>,
        })}
      </div>
    ));

    expect(native.getAllText().join('')).toContain('outer:inner');
    inner.set(false);
    renderer.flush();
    expect(native.getAllText().join('')).not.toContain('inner');

    outer.set(false);
    renderer.flush();
    expect(native.getAllText().join('')).toContain('fallback');

    await new Promise((resolve) => setTimeout(resolve, 1));
    renderer.flush();
    expect(native.findByType('div').length).toBe(1);
  });

  it('reorders a keyed For without rebuilding retained native nodes', () => {
    const { renderer, native } = createRenderer();
    const items = Cell.source([
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
      { id: 4, label: 'D' },
      { id: 5, label: 'E' },
    ]);

    renderer.render(() => (
      <div>
        {For(
          items,
          (item) => (
            <text>{item.label}</text>
          ),
          { key: 'id' }
        )}
      </div>
    ));
    const idsBefore = native.findByType('text').toSorted();

    const current = items.get();
    items.set([...current.slice(1), current[0]]);
    renderer.flush();

    expect(native.getAllText()).toEqual(['B', 'C', 'D', 'E', 'A']);
    expect(native.findByType('text').toSorted()).toEqual(idsBefore);
  });

  it('supports keyed insertion and removal', () => {
    const { renderer, native } = createRenderer();
    const items = Cell.source([
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
    ]);

    renderer.render(() => (
      <div>
        {For(
          items,
          (item) => (
            <text>{item.label}</text>
          ),
          { key: 'id' }
        )}
      </div>
    ));

    items.set([
      { id: 1, label: 'A' },
      { id: 3, label: 'C' },
      { id: 2, label: 'B' },
    ]);
    renderer.flush();
    expect(native.getAllText()).toEqual(['A', 'C', 'B']);

    items.set([
      { id: 3, label: 'C' },
      { id: 2, label: 'B' },
    ]);
    renderer.flush();
    expect(native.getAllText()).toEqual(['C', 'B']);
  });

  it('moves a Unique instance without destroying its native identity', async () => {
    const { renderer, native } = createRenderer();
    const showSecond = Cell.source(false);
    const showFirst = Cell.derived(() => !showSecond.get());
    let uniqueId: number | null = null;
    const capture = (node: GpuiElement | null) => {
      if (node) uniqueId = node.id;
    };
    const UniqueContent = createUnique(() => {
      return <div ref={capture}>Unique Data</div>;
    });

    renderer.render(() => (
      <div>
        {If(showFirst, () => (
          <UniqueContent id="shared" />
        ))}
        {If(showSecond, () => (
          <UniqueContent id="shared" />
        ))}
      </div>
    ));
    await runPendingSetupEffects();
    renderer.flush();
    const firstId = uniqueId;

    showSecond.set(true);
    await Promise.resolve();
    await runPendingSetupEffects();
    renderer.flush();

    expect(uniqueId).toBe(firstId);
    expect(native.getAllText()).toEqual(['Unique Data']);
    expect(native.findByType('div')).toContain(firstId);
  });

  it('destroys pending detached subtrees when disposed before deferred cleanup', () => {
    const { renderer, native } = createRenderer();
    const show = Cell.source(true);

    renderer.render(() => (
      <div>
        {If(show, () => (
          <div>orphan candidate</div>
        ))}
      </div>
    ));
    show.set(false);
    renderer.dispose();
    activeRenderer = null;

    expect(native.findByType('div')).toEqual([]);
    expect(native.findByType('text')).toEqual([]);
  });

  it('stops reactive writes after a native subtree is destroyed', async () => {
    const { renderer, native } = createRenderer();
    const show = Cell.source(true);
    const color = Cell.source<GpuiColor>('#ffffff');
    const code = Cell.source('const first = true;');

    renderer.render(() => (
      <div>
        {If(show, () => (
          <code code={code} style={{ color }} />
        ))}
      </div>
    ));

    show.set(false);
    renderer.flush();
    await new Promise((resolve) => setTimeout(resolve, 1));
    renderer.flush();
    expect(native.findByType('code')).toEqual([]);

    Cell.batch(() => {
      color.set('#000000');
      code.set('const stale = true;');
    });
    renderer.flush();
    expect(native.findByType('code')).toEqual([]);
  });

  it('keeps shared reactive state isolated across renderer roots', () => {
    const shared = Cell.source(false);
    const firstNative = new TestGpuixRenderer();
    const firstRenderer = new RetendGpuiRenderer(firstNative);
    firstRenderer.init();
    setActiveRenderer(firstRenderer);
    firstRenderer.render(() => (
      <div>
        {If(shared, {
          true: () => <text>first: true</text>,
          false: () => <text>first: false</text>,
        })}
      </div>
    ));

    const secondNative = new TestGpuixRenderer();
    const secondRenderer = new RetendGpuiRenderer(secondNative);
    secondRenderer.init();
    setActiveRenderer(secondRenderer);
    activeRenderer = secondRenderer;
    secondRenderer.render(() => (
      <div>
        {If(shared, {
          true: () => <text>second: true</text>,
          false: () => <text>second: false</text>,
        })}
      </div>
    ));

    expect(firstNative.getAllText()).toContain('first: false');
    expect(secondNative.getAllText()).toContain('second: false');

    shared.set(true);
    firstRenderer.flush();
    secondRenderer.flush();

    expect(firstNative.getAllText()).toContain('first: true');
    expect(firstNative.getAllText()).not.toContain('second: true');
    expect(secondNative.getAllText()).toContain('second: true');
    expect(secondNative.getAllText()).not.toContain('first: true');

    firstRenderer.dispose();
  });

  it('reactively removes and restores native event listeners through JSX', () => {
    const { renderer, native } = createRenderer();
    const targetRef = Cell.source<GpuiElement | null>(null);
    const handler = Cell.source<
      ((event: EventPayload) => void) | null | undefined
    >(() => undefined);

    renderer.render(() => (
      <div ref={targetRef} onClick={handler}>
        event target
      </div>
    ));
    const target = targetRef.get();
    if (!target) throw new Error('Expected ref to resolve synchronously.');

    expect(native.hasEventListener(target.id, 'click')).toBe(true);

    handler.set(null);
    renderer.flush();
    expect(native.hasEventListener(target.id, 'click')).toBe(false);

    handler.set(() => undefined);
    renderer.flush();
    expect(native.hasEventListener(target.id, 'click')).toBe(true);
  });

  it('holds Await fallback for async text, style, and custom props', async () => {
    const { renderer, native } = createRenderer();
    const borderColor = Cell.derivedAsync(async (): Promise<GpuiColor> => {
      await Promise.resolve();
      return '#22c55e';
    });
    const status = Cell.derivedAsync(async () => {
      await Promise.resolve();
      return 'loaded';
    });
    const code = Cell.derivedAsync(async () => {
      await Promise.resolve();
      return 'const loaded = true;';
    });
    const codeRef = Cell.source<GpuiElement | null>(null);

    renderer.render(() => (
      <Await fallback={<text>loading</text>}>
        <div style={{ borderColor }}>
          <text>{status}</text>
          <code ref={codeRef} code={code} />
        </div>
      </Await>
    ));

    expect(native.getAllText()).toEqual(['loading']);
    await waitForAsyncBoundaries();
    renderer.flush();
    expect(native.getAllText()).toContain('loaded');

    const codeNode = codeRef.get();
    if (!codeNode) throw new Error('Expected async code ref to resolve.');
    expect(
      JSON.parse(native.getCustomProp(codeNode.id, 'code') ?? 'null')
    ).toBe('const loaded = true;');
  });
});

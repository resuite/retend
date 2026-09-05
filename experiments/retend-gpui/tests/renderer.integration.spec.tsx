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
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GpuiElement } from '../source/gpui-renderer';
import type { GpuiColor, GpuiStyle } from '../source/types';

import { RetendGpuiRenderer } from '../source/gpui-renderer';
import { NativeRendererFatalError } from '../source/native/addon';
import { ElementKind, PropertyId } from '../source/native/protocol';
import { hotReloadModule } from '../source/plugins/hmr';

interface DebugNode {
  id: number;
  kind: 'Root' | 'Container' | 'Text' | 'Image';
  parent: number | null;
  children: number[];
  text: string | null;
  src: string | null;
}

interface DebugTree {
  root_id: number;
  poisoned: boolean;
  pending_detached: number[];
  nodes: DebugNode[];
}

let activeRenderer: RetendGpuiRenderer | null = null;

interface RendererOptions {
  hmr?: boolean;
}

function createRenderer(options: RendererOptions = {}): RetendGpuiRenderer {
  const renderer = new RetendGpuiRenderer({ ...options, headless: true });
  renderer.init();
  setActiveRenderer(renderer);
  activeRenderer = renderer;
  return renderer;
}

function debugTree(renderer: RetendGpuiRenderer): DebugTree {
  renderer.flush();
  return renderer.host.debugTree() as DebugTree;
}

function nodeMap(tree: DebugTree): Map<number, DebugNode> {
  return new Map(tree.nodes.map((node) => [node.id, node]));
}

function collectText(tree: DebugTree): string[] {
  const nodes = nodeMap(tree);
  const text: string[] = [];
  const visit = (id: number): void => {
    const node = nodes.get(id);
    if (!node) return;
    if (node.kind === 'Text') text.push(node.text ?? '');
    for (const child of node.children) visit(child);
  };
  visit(tree.root_id);
  return text;
}

function idsByKind(tree: DebugTree, kind: DebugNode['kind']): number[] {
  return tree.nodes.filter((node) => node.kind === kind).map((node) => node.id);
}

afterEach(() => {
  activeRenderer?.dispose();
  activeRenderer = null;
});

describe('Retend GPUI renderer on the Retend-owned native bridge', () => {
  it('maintains window-local location and history state', () => {
    const renderer = createRenderer();
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
    const renderer = createRenderer();
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

  it('rejects tags outside the Retend GPUI intrinsic surface', () => {
    const renderer = createRenderer();
    expect(() => renderer.createContainer('text')).toThrow(
      'text is ordinary JSX content'
    );
    for (const tag of ['code', 'input', 'textarea']) {
      expect(() => renderer.createContainer(tag)).toThrow(
        `Unsupported Retend GPUI intrinsic element: <${tag}>`
      );
    }
  });

  it('rejects logical children on leaf native elements before bridge submission', () => {
    const renderer = createRenderer();
    const image = renderer.createContainer('img');
    const child = renderer.createText('invalid child');

    expect(() => renderer.append(image, child)).toThrow(
      '<img> cannot contain GPUI children.'
    );
    expect(image.children).toEqual([]);
  });

  it('renders div and text under the immutable native window root', () => {
    const renderer = createRenderer();
    const rootRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => <div ref={rootRef}>hello</div>);

    const tree = debugTree(renderer);
    const nodes = nodeMap(tree);
    const root = rootRef.get();
    if (!root) throw new Error('Expected root ref to resolve.');

    expect(nodes.get(tree.root_id)?.kind).toBe('Root');
    expect(nodes.get(tree.root_id)?.children).toEqual([root.id]);
    expect(nodes.get(root.id)?.kind).toBe('Container');
    expect(collectText(tree)).toEqual(['hello']);
  });

  it('projects top-level fragment content directly under the immutable root', () => {
    const renderer = createRenderer();
    const imageRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => (
      <>
        before
        <img ref={imageRef} src="https://example.com/root.png" />
        after
      </>
    ));

    const tree = debugTree(renderer);
    const nodes = nodeMap(tree);
    const root = nodes.get(tree.root_id);
    expect(root?.children.map((id) => nodes.get(id)?.kind)).toEqual([
      'Text',
      'Image',
      'Text',
    ]);
    expect(idsByKind(tree, 'Container')).toEqual([]);
    expect(collectText(tree)).toEqual(['before', 'after']);
  });

  it('updates ordinary text through CREATE_TEXT/UPDATE_TEXT semantics', () => {
    const renderer = createRenderer();
    const label = Cell.source('before');
    renderer.render(() => <div>{label}</div>);

    expect(collectText(debugTree(renderer))).toEqual(['before']);
    label.set('after');
    expect(collectText(debugTree(renderer))).toEqual(['after']);
  });

  it('preserves mixed text and image source order', () => {
    const renderer = createRenderer();
    const imageRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => (
      <div>
        before
        <img ref={imageRef} src="https://example.com/image.png" />
        after
      </div>
    ));

    const tree = debugTree(renderer);
    const nodes = nodeMap(tree);
    const image = imageRef.get();
    if (!image) throw new Error('Expected image ref to resolve.');
    const parent = nodes.get(image.id)?.parent;
    if (!parent) throw new Error('Expected image to have a parent.');

    expect(
      nodes.get(parent)?.children.map((id) => nodes.get(id)?.kind)
    ).toEqual(['Text', 'Image', 'Text']);
    expect(nodes.get(image.id)?.src).toBe('https://example.com/image.png');
    expect(collectText(tree)).toEqual(['before', 'after']);
  });

  it('maps image src and objectFit through the native property vocabulary', () => {
    const renderer = createRenderer();
    const imageRef = Cell.source<GpuiElement | null>(null);
    const setProperty = vi.spyOn(renderer.host, 'setProperty');
    const src = Cell.source('https://example.com/first.png');
    const objectFit = Cell.source<'contain' | 'cover'>('contain');

    renderer.render(() => (
      <img ref={imageRef} src={src} objectFit={objectFit} />
    ));
    const image = imageRef.get();
    if (!image) throw new Error('Expected image ref to resolve.');

    expect(setProperty).toHaveBeenCalledWith(
      image.id,
      PropertyId.Src,
      'https://example.com/first.png'
    );
    expect(setProperty).toHaveBeenCalledWith(
      image.id,
      PropertyId.ObjectFit,
      'contain'
    );

    Cell.batch(() => {
      src.set('https://example.com/second.png');
      objectFit.set('cover');
    });
    const tree = debugTree(renderer);
    expect(nodeMap(tree).get(image.id)?.src).toBe(
      'https://example.com/second.png'
    );
    expect(setProperty).toHaveBeenCalledWith(
      image.id,
      PropertyId.ObjectFit,
      'cover'
    );
  });

  it('publishes complete resolved author-style snapshots', () => {
    const renderer = createRenderer();
    const targetRef = Cell.source<GpuiElement | null>(null);
    const style = Cell.source<GpuiStyle>({ width: 120, color: '#ffffff' });
    const setStyle = vi.spyOn(renderer.host, 'setStyle');

    renderer.render(() => (
      <div ref={targetRef} style={style}>
        styled
      </div>
    ));
    const target = targetRef.get();
    if (!target) throw new Error('Expected target ref to resolve.');

    expect(setStyle).toHaveBeenCalledWith(target.id, [
      [PropertyId.Width, 120],
      [PropertyId.Color, '#ffffff'],
    ]);

    setStyle.mockClear();
    style.set({ color: '#22c55e' });
    renderer.flush();

    expect(setStyle).toHaveBeenCalledOnce();
    expect(setStyle).toHaveBeenCalledWith(target.id, [
      [PropertyId.Color, '#22c55e'],
    ]);
  });

  it('renders and hot-reloads a root component through HMR boundaries', () => {
    const renderer = createRenderer({ hmr: true });

    function App() {
      return <div>before</div>;
    }
    function NextApp() {
      return <div>after</div>;
    }

    renderer.render(() => <App />);
    expect(collectText(debugTree(renderer))).toEqual(['before']);

    hotReloadModule({ default: NextApp }, { default: App });
    expect(collectText(debugTree(renderer))).toEqual(['after']);
  });

  it('rejects removing or replacing rendered component exports during HMR', () => {
    const renderer = createRenderer({ hmr: true });

    function App() {
      return <div>before</div>;
    }

    renderer.render(() => <App />);
    expect(() => hotReloadModule({}, { Panel: App })).toThrow(
      'replacement module no longer exports a component function'
    );
    expect(() => hotReloadModule({ Panel: 42 }, { Panel: App })).toThrow(
      'replacement module no longer exports a component function'
    );
  });

  it('shows an error root without destroying the application subtree', () => {
    const renderer = createRenderer();
    const appRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => <div ref={appRef}>application</div>);
    const app = appRef.get();
    if (!app) throw new Error('Expected application ref to resolve.');

    renderer.showDevelopmentError(new Error('broken update'));
    let tree = debugTree(renderer);
    expect(collectText(tree).join('')).toContain('broken update');
    expect(tree.nodes.some((node) => node.id === app.id)).toBe(true);
    expect(tree.pending_detached).toContain(app.id);

    renderer.clearDevelopmentError();
    tree = debugTree(renderer);
    expect(collectText(tree)).toEqual(['application']);
    expect(tree.pending_detached).not.toContain(app.id);
  });

  it('replaces nested If ranges and settles abandoned native subtrees', async () => {
    const renderer = createRenderer();
    const outer = Cell.source(true);
    const inner = Cell.source(true);

    renderer.render(() => (
      <div>
        {If(outer, {
          true: () => (
            <div>
              outer:
              {If(inner, () => 'inner')}
            </div>
          ),
          false: () => 'fallback',
        })}
      </div>
    ));

    expect(collectText(debugTree(renderer)).join('')).toContain('outer:inner');
    inner.set(false);
    expect(collectText(debugTree(renderer)).join('')).not.toContain('inner');

    outer.set(false);
    expect(collectText(debugTree(renderer))).toEqual(['fallback']);

    await new Promise((resolve) => setTimeout(resolve, 1));
    const tree = debugTree(renderer);
    expect(idsByKind(tree, 'Container')).toHaveLength(1);
  });

  it('reorders a keyed For without rebuilding retained text nodes', () => {
    const renderer = createRenderer();
    const items = Cell.source([
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
      { id: 4, label: 'D' },
      { id: 5, label: 'E' },
    ]);

    renderer.render(() => (
      <div>{For(items, (item) => item.label, { key: 'id' })}</div>
    ));
    const before = debugTree(renderer);
    const idsBefore = idsByKind(before, 'Text').toSorted();

    const current = items.get();
    items.set([...current.slice(1), current[0]]);
    const after = debugTree(renderer);

    expect(collectText(after)).toEqual(['B', 'C', 'D', 'E', 'A']);
    expect(idsByKind(after, 'Text').toSorted()).toEqual(idsBefore);
  });

  it('supports keyed insertion and removal', async () => {
    const renderer = createRenderer();
    const items = Cell.source([
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
    ]);

    renderer.render(() => (
      <div>{For(items, (item) => item.label, { key: 'id' })}</div>
    ));

    items.set([
      { id: 1, label: 'A' },
      { id: 3, label: 'C' },
      { id: 2, label: 'B' },
    ]);
    expect(collectText(debugTree(renderer))).toEqual(['A', 'C', 'B']);

    items.set([
      { id: 3, label: 'C' },
      { id: 2, label: 'B' },
    ]);
    expect(collectText(debugTree(renderer))).toEqual(['C', 'B']);
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(idsByKind(debugTree(renderer), 'Text')).toHaveLength(2);
  });

  it('moves a Unique instance without destroying its native identity', async () => {
    const renderer = createRenderer();
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
    const firstId = uniqueId;

    showSecond.set(true);
    await Promise.resolve();
    await runPendingSetupEffects();
    const tree = debugTree(renderer);

    expect(uniqueId).toBe(firstId);
    expect(collectText(tree)).toEqual(['Unique Data']);
    expect(idsByKind(tree, 'Container')).toContain(firstId);
  });

  it('unmount settles attached and never-attached renderer nodes while keeping the window root', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>mounted</div>);
    renderer.createContainer('div');
    renderer.flush();

    expect(debugTree(renderer).nodes.length).toBeGreaterThan(1);
    renderer.unmount();

    const tree = debugTree(renderer);
    expect(tree.nodes).toEqual([
      expect.objectContaining({ id: tree.root_id, kind: 'Root', children: [] }),
    ]);
    expect(renderer.hasRoot).toBe(false);
  });

  it('discards the failed root and its reactive work', async () => {
    const renderer = createRenderer();
    const ref = Cell.source<GpuiElement | null>(null);
    const color = Cell.source<GpuiColor>('#ffffff');
    const text = Cell.source('mounted');
    renderer.render(() => (
      <div ref={ref} style={{ color }}>
        {text}
      </div>
    ));
    const node = ref.get();
    if (!node) throw new Error('Expected mounted ref to resolve.');

    renderer.host.createNode(ElementKind.Input);
    expect(() => renderer.flush()).toThrow(NativeRendererFatalError);
    expect(renderer.hasRoot).toBe(false);
    expect(renderer.host.isInitialized).toBe(true);
    expect(node.destroyed).toBe(true);
    expect(ref.get()).toBeNull();

    const setStyle = vi.spyOn(renderer.host, 'setStyle');
    const updateText = vi.spyOn(renderer.host, 'updateText');
    Cell.batch(() => {
      color.set('#000000');
      text.set('stale');
    });
    await Promise.resolve();

    expect(setStyle).not.toHaveBeenCalled();
    expect(updateText).not.toHaveBeenCalled();
  });

  it('discards commands queued by fatal cleanup', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>mounted</div>);
    renderer.host.addEventListener('fatal', () => {
      renderer.host.createText('cleanup');
    });

    renderer.host.createNode(ElementKind.Input);
    expect(() => renderer.flush()).toThrow(NativeRendererFatalError);
    expect(() => renderer.flush()).not.toThrow();
  });

  it('cleans partial renderer state when render throws', () => {
    const renderer = createRenderer();
    expect(() =>
      renderer.render(() => {
        renderer.createText('partial');
        throw new Error('render failed');
      })
    ).toThrow('render failed');

    expect(renderer.hasRoot).toBe(false);
    expect(() => renderer.flush()).not.toThrow();
    expect(renderer.host.debugTree()).toEqual(
      expect.objectContaining({
        nodes: [expect.objectContaining({ kind: 'Root' })],
      })
    );

    renderer.showDevelopmentError('render failed');
    expect(collectText(debugTree(renderer))).toEqual(['render failed']);
  });

  it('does not leave a partial development overlay on a fatal renderer', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>mounted</div>);
    renderer.host.createNode(ElementKind.Input);
    expect(() => renderer.flush()).toThrow(NativeRendererFatalError);

    expect(() => renderer.showDevelopmentError('ordinary error')).toThrow(
      NativeRendererFatalError
    );
    expect(renderer.hasRoot).toBe(false);
    expect(() => renderer.flush()).not.toThrow();
  });

  it('cannot be initialized again after disposal', () => {
    const renderer = createRenderer();
    renderer.dispose();
    activeRenderer = null;

    expect(() => renderer.init()).toThrow(
      'A disposed RetendGpuiRenderer cannot be initialized again.'
    );
  });

  it('destroys pending detached subtrees when disposed before deferred cleanup', () => {
    const renderer = createRenderer();
    const show = Cell.source(true);
    const ref = Cell.source<GpuiElement | null>(null);

    renderer.render(() => (
      <div>
        {If(show, () => (
          <div ref={ref}>orphan candidate</div>
        ))}
      </div>
    ));
    const node = ref.get();
    if (!node) throw new Error('Expected detached candidate ref to resolve.');

    show.set(false);
    renderer.dispose();
    activeRenderer = null;

    expect(node.destroyed).toBe(true);
    expect(ref.get()).toBeNull();
  });

  it('stops reactive native writes after a subtree is destroyed', async () => {
    const renderer = createRenderer();
    const show = Cell.source(true);
    const color = Cell.source<GpuiColor>('#ffffff');
    const text = Cell.source('first');

    renderer.render(() => (
      <div>
        {If(show, () => (
          <div style={{ color }}>{text}</div>
        ))}
      </div>
    ));

    show.set(false);
    renderer.flush();
    await new Promise((resolve) => setTimeout(resolve, 1));
    renderer.flush();

    const setStyle = vi.spyOn(renderer.host, 'setStyle');
    const updateText = vi.spyOn(renderer.host, 'updateText');
    Cell.batch(() => {
      color.set('#000000');
      text.set('stale');
    });
    renderer.flush();

    expect(setStyle).not.toHaveBeenCalled();
    expect(updateText).not.toHaveBeenCalled();
  });

  it('keeps shared reactive state isolated across renderer roots', () => {
    const shared = Cell.source(false);
    const firstRenderer = createRenderer();
    firstRenderer.render(() => (
      <div>
        {If(shared, {
          true: () => 'first: true',
          false: () => 'first: false',
        })}
      </div>
    ));

    const secondRenderer = createRenderer();
    secondRenderer.render(() => (
      <div>
        {If(shared, {
          true: () => 'second: true',
          false: () => 'second: false',
        })}
      </div>
    ));

    expect(collectText(debugTree(firstRenderer))).toEqual(['first: false']);
    expect(collectText(debugTree(secondRenderer))).toEqual(['second: false']);

    shared.set(true);
    expect(collectText(debugTree(firstRenderer))).toEqual(['first: true']);
    expect(collectText(debugTree(secondRenderer))).toEqual(['second: true']);

    firstRenderer.dispose();
  });

  it('holds Await fallback for async text, style, and image props', async () => {
    const renderer = createRenderer();
    const borderColor = Cell.derivedAsync(async (): Promise<GpuiColor> => {
      await Promise.resolve();
      return '#22c55e';
    });
    const status = Cell.derivedAsync(async () => {
      await Promise.resolve();
      return 'loaded';
    });
    const src = Cell.derivedAsync(async () => {
      await Promise.resolve();
      return 'https://example.com/loaded.png';
    });
    const imageRef = Cell.source<GpuiElement | null>(null);

    renderer.render(() => (
      <Await fallback="loading">
        <div style={{ borderColor }}>
          {status}
          <img ref={imageRef} src={src} />
        </div>
      </Await>
    ));

    expect(collectText(debugTree(renderer))).toEqual(['loading']);
    await waitForAsyncBoundaries();
    const tree = debugTree(renderer);
    expect(collectText(tree)).toContain('loaded');

    const image = imageRef.get();
    if (!image) throw new Error('Expected async image ref to resolve.');
    expect(nodeMap(tree).get(image.id)?.src).toBe(
      'https://example.com/loaded.png'
    );
  });
});

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

import {
  GpuiButtonElement,
  GpuiDivElement,
  GpuiImageElement,
  GpuiInputElement,
  GpuiTextareaElement,
  GpuiText,
  RetendGpuiRenderer,
} from '../source/gpui-renderer';
import { NativeRendererFatalError } from '../source/native/addon';
import { ElementKind, PropertyId, StyleState } from '../source/native/protocol';
import { NativeEventId } from '../source/native/protocol.generated';
import { hotReloadModule } from '../source/plugins/hmr';
import {
  collectText,
  createRenderer,
  debugTree,
  disposeRenderers,
  idsByKind,
  nodeMap,
} from './helpers';

afterEach(disposeRenderers);

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

  it('keeps independent renderer roots isolated across remounts', () => {
    const first = new RetendGpuiRenderer({ headless: true });
    const second = new RetendGpuiRenderer({ headless: true });
    first.init();
    second.init();
    const firstText = Cell.source('first');
    const secondText = Cell.source('second');
    const firstRootId = first.host.rootId;
    const secondRootId = second.host.rootId;

    try {
      first.host.resetLocation('/first/detail');
      second.host.resetLocation('/second/detail');
      setActiveRenderer(first);
      first.render(() => <div>{firstText}</div>);
      setActiveRenderer(second);
      second.render(() => <div>{secondText}</div>);

      firstText.set('first-updated');
      expect(collectText(debugTree(first))).toEqual(['first-updated']);
      expect(collectText(debugTree(second))).toEqual(['second']);

      first.unmount();
      second.unmount();
      firstText.set('first-remounted');
      setActiveRenderer(first);
      first.render(() => <div>{firstText}</div>);
      setActiveRenderer(second);
      second.render(() => <div>{secondText}</div>);

      expect(first.host.rootId).toBe(firstRootId);
      expect(second.host.rootId).toBe(secondRootId);
      expect(first.host.location.href).toBe('/first/detail');
      expect(second.host.location.href).toBe('/second/detail');
      expect(collectText(debugTree(first))).toEqual(['first-remounted']);
      expect(collectText(debugTree(second))).toEqual(['second']);
    } finally {
      first.dispose();
      second.dispose();
    }
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
    expect(() => renderer.createContainer('input')).not.toThrow();
    expect(() => renderer.createContainer('textarea')).not.toThrow();
    expect(() => renderer.createContainer('button')).not.toThrow();
    expect(() => renderer.createContainer('code')).toThrow(
      'Unsupported Retend GPUI intrinsic element: <code>'
    );
  });

  it('creates direct native button elements', () => {
    const renderer = createRenderer();
    const button = renderer.createContainer('button');

    expect(button).toBeInstanceOf(GpuiButtonElement);
    expect(button.tagName).toBe('button');

    const tree = debugTree(renderer);
    expect(tree.nodes.find((node) => node.id === button.id)?.kind).toBe(
      'Button'
    );
  });

  it('maps button props to native properties', () => {
    const renderer = createRenderer();
    const setProperty = vi.spyOn(renderer.host, 'setProperty');
    const buttonRef = Cell.source<GpuiButtonElement | null>(null);

    renderer.render(() => (
      <div>
        <button ref={buttonRef} disabled>
          Save
        </button>
      </div>
    ));

    const button = buttonRef.get();
    if (!button) throw new Error('Expected the button ref to resolve.');
    expect(setProperty).toHaveBeenCalledWith(
      button.id,
      PropertyId.Disabled,
      true
    );
  });

  it('exposes tabIndex with native focus and blur commands', () => {
    const renderer = createRenderer();
    const targetRef = Cell.source<GpuiElement | null>(null);
    const focusNode = vi.spyOn(renderer.host, 'focusNode');
    const blurNode = vi.spyOn(renderer.host, 'blurNode');
    const subscribe = vi.spyOn(renderer.host, 'subscribeEvent');
    const handleFocus = () => {};
    const handleBlur = () => {};

    renderer.render(() => (
      <div
        ref={targetRef}
        tabIndex={-1}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    ));
    const target = targetRef.get();
    if (!target) throw new Error('Expected focus target ref to resolve.');

    expect(subscribe).toHaveBeenCalledWith(target.id, NativeEventId.Focus);
    expect(subscribe).toHaveBeenCalledWith(target.id, NativeEventId.Blur);

    target.focus();
    target.blur();
    expect(focusNode).toHaveBeenCalledWith(target.id);
    expect(blurNode).toHaveBeenCalledWith(target.id);

    renderer.unmount();
    expect(() => target.focus()).toThrow('destroyed Retend GPUI node');
    expect(() => target.blur()).toThrow('destroyed Retend GPUI node');
  });

  it('scopes text-selection APIs to native text controls', async () => {
    const renderer = createRenderer();
    const div = renderer.createContainer('div');
    const image = renderer.createContainer('img');
    const input = renderer.createContainer('input');
    const textarea = renderer.createContainer('textarea');
    const setSelection = vi
      .spyOn(renderer.host, 'setSelectionRangeNode')
      .mockImplementation(() => {});
    const select = vi
      .spyOn(renderer.host, 'selectNode')
      .mockImplementation(() => {});
    const getSelection = vi
      .spyOn(renderer.host, 'getSelectionNode')
      .mockResolvedValue({ start: 1, end: 3 });

    expect(div).toBeInstanceOf(GpuiDivElement);
    expect(image).toBeInstanceOf(GpuiImageElement);
    expect(input).toBeInstanceOf(GpuiInputElement);
    expect(textarea).toBeInstanceOf(GpuiTextareaElement);
    expect('select' in div).toBe(false);
    expect('setSelectionRange' in image).toBe(false);
    expect('getSelection' in div).toBe(false);

    const controls = [input, textarea];
    const selections = controls.map((control) => {
      control.setSelectionRange(1, 3);
      control.select();
      return control.getSelection();
    });
    await expect(Promise.all(selections)).resolves.toEqual([
      { start: 1, end: 3 },
      { start: 1, end: 3 },
    ]);

    for (const control of controls) {
      expect(setSelection).toHaveBeenCalledWith(control.id, 1, 3);
      expect(select).toHaveBeenCalledWith(control.id);
      expect(getSelection).toHaveBeenCalledWith(control.id);
    }
  });

  it('registers JSX native events on the element types that expose them', () => {
    const renderer = createRenderer();
    const rootRef = Cell.source<GpuiDivElement | null>(null);
    const inputRef = Cell.source<GpuiInputElement | null>(null);
    const subscribe = vi.spyOn(renderer.host, 'subscribeEvent');
    const unsubscribe = vi.spyOn(renderer.host, 'unsubscribeEvent');
    const click = vi.fn();
    const input = vi.fn();
    const change = vi.fn();

    renderer.render(() => (
      <div ref={rootRef} onClick={click}>
        <input ref={inputRef} onInput={input} onChange={change} />
      </div>
    ));
    const root = rootRef.get();
    const inputNode = inputRef.get();
    if (!root || !inputNode) throw new Error('Expected refs to resolve.');
    expect(subscribe).toHaveBeenCalledWith(root.id, NativeEventId.Click);
    expect(subscribe).toHaveBeenCalledWith(inputNode.id, NativeEventId.Input);
    expect(subscribe).toHaveBeenCalledWith(inputNode.id, NativeEventId.Change);

    const move = vi.fn();
    root.addEventListener('mousemove', move);
    expect(subscribe).toHaveBeenCalledWith(root.id, NativeEventId.MouseMove);

    root.removeEventListener('mousemove', move);
    expect(unsubscribe).toHaveBeenCalledWith(root.id, NativeEventId.MouseMove);
  });

  it('preserves Retend event-modifier ordering for descendant events', () => {
    const renderer = createRenderer();
    const root = renderer.createContainer('div');
    const selfThenStop = renderer.createContainer('div');
    const stopThenSelf = renderer.createContainer('div');
    const firstChild = renderer.createContainer('div');
    const secondChild = renderer.createContainer('div');
    renderer.append(selfThenStop, firstChild);
    renderer.append(stopThenSelf, secondChild);
    renderer.append(root, [selfThenStop, stopThenSelf]);
    renderer.render(() => root);

    const rootListener = vi.fn();
    const selfThenStopListener = vi.fn();
    const stopThenSelfListener = vi.fn();
    root.addEventListener('click', rootListener);
    renderer.setProperty(
      selfThenStop,
      'onClick--self--stop',
      selfThenStopListener
    );
    renderer.setProperty(
      stopThenSelf,
      'onClick--stop--self',
      stopThenSelfListener
    );

    firstChild.dispatchEvent(new Event('click', { bubbles: true }));
    expect(selfThenStopListener).not.toHaveBeenCalled();
    expect(rootListener).not.toHaveBeenCalled();

    secondChild.dispatchEvent(new Event('click', { bubbles: true }));
    expect(stopThenSelfListener).not.toHaveBeenCalled();
    expect(rootListener).toHaveBeenCalledOnce();
  });

  it('types and applies passive semantics to JSX event modifiers', () => {
    const renderer = createRenderer();
    const targetRef = Cell.source<GpuiElement | null>(null);
    const listener = vi.fn((event: Event) => event.preventDefault());
    renderer.render(() => <div ref={targetRef} onClick--passive={listener} />);
    const target = targetRef.get();
    if (!target) throw new Error('Expected event target ref to resolve.');
    const event = new Event('click', { bubbles: true, cancelable: true });

    expect(target.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('flushes a pending active insertion together with its native event subscription', () => {
    const renderer = createRenderer();
    const parentRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => <div ref={parentRef} />);
    const parent = parentRef.get();
    if (!parent) throw new Error('Expected parent ref to resolve.');

    const child = renderer.createContainer('div');
    const flush = vi.spyOn(renderer.host, 'flush');
    const subscribe = vi.spyOn(renderer.host, 'subscribeEvent');
    renderer.append(parent, child);
    child.addEventListener('click', () => {});

    expect(flush).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith(child.id, NativeEventId.Click);
    expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      flush.mock.invocationCallOrder[0]
    );
  });

  it('leaves detached native listener registration batched', () => {
    const renderer = createRenderer();
    const node = renderer.createContainer('div');
    const flush = vi.spyOn(renderer.host, 'flush');
    const subscribe = vi.spyOn(renderer.host, 'subscribeEvent');

    node.addEventListener('click', () => {});

    expect(subscribe).toHaveBeenCalledWith(node.id, NativeEventId.Click);
    expect(flush).not.toHaveBeenCalled();
  });

  it('exposes node-bound scrolling and maps overflow through the native style vocabulary', async () => {
    const renderer = createRenderer();
    const ref = Cell.source<GpuiElement | null>(null);
    const setStyle = vi.spyOn(renderer.host, 'setStyle');
    const scrollToNode = vi.spyOn(renderer.host, 'scrollToNode');
    const scrollByNode = vi.spyOn(renderer.host, 'scrollByNode');
    const scrollIntoViewNode = vi.spyOn(renderer.host, 'scrollIntoViewNode');
    renderer.render(() => (
      <div ref={ref} style={{ width: 100, height: 50, overflow: 'scroll' }}>
        <div style={{ height: 200 }} />
      </div>
    ));
    const node = ref.get();
    if (!node) throw new Error('Expected scroll container ref to resolve.');

    expect(setStyle).toHaveBeenCalledWith(
      node.id,
      expect.arrayContaining([[PropertyId.Overflow, 'scroll']])
    );
    node.scrollTo(10, 20);
    node.scrollBy(-5, 15);
    node.scrollIntoView();
    expect(scrollToNode).toHaveBeenCalledWith(node.id, 10, 20);
    expect(scrollByNode).toHaveBeenCalledWith(node.id, -5, 15);
    expect(scrollIntoViewNode).toHaveBeenCalledWith(node.id);
    await expect(node.getScrollOffset()).resolves.toEqual({ x: 0, y: 0 });
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

  it('ignores style property assignments on text nodes without poisoning the bridge', () => {
    const renderer = createRenderer();
    const text = renderer.createText('plain');
    renderer.render(() => <div>{text}</div>);
    const setStyle = vi.spyOn(renderer.host, 'setStyle');

    renderer.setProperty(text, 'style', { color: '#ffffff' });
    renderer.flush();

    expect(setStyle).not.toHaveBeenCalled();
    expect(debugTree(renderer).poisoned).toBe(false);
  });

  it('routes listener exceptions through the application error path without poisoning', () => {
    const renderer = createRenderer();
    const ref = Cell.source<GpuiElement | null>(null);
    const applicationErrors: unknown[] = [];
    const afterFailure = vi.fn();
    renderer.host.addEventListener('applicationerror', (event) => {
      applicationErrors.push((event as CustomEvent<unknown>).detail);
    });
    renderer.render(() => <div ref={ref}>event target</div>);
    const node = ref.get();
    if (!node) throw new Error('Expected event target ref to resolve.');

    node.addEventListener('custom', () => {
      throw new Error('listener failure');
    });
    node.addEventListener('custom', afterFailure);
    node.dispatchEvent(new Event('custom'));

    expect(applicationErrors).toHaveLength(1);
    expect(applicationErrors[0]).toBeInstanceOf(Error);
    expect(afterFailure).toHaveBeenCalledOnce();
    expect(debugTree(renderer).poisoned).toBe(false);
  });

  it('exposes asynchronous measure() on native elements and rejects destroyed nodes', async () => {
    const renderer = createRenderer();
    const ref = Cell.source<GpuiElement | null>(null);
    const measureNode = vi.spyOn(renderer.host, 'measureNode');
    renderer.render(() => <div ref={ref} style={{ width: 120, height: 48 }} />);
    const node = ref.get();
    if (!node) throw new Error('Expected measured node ref to resolve.');

    await expect(node.measure()).resolves.toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scrollWidth: 0,
      scrollHeight: 0,
    });
    expect(measureNode).toHaveBeenCalledWith(node.id);

    renderer.unmount();
    await expect(node.measure()).rejects.toThrow('destroyed Retend GPUI node');
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

  it('keeps reactive text identity through detach and reinsert, then cleans it up', async () => {
    const renderer = createRenderer();
    const label = Cell.source('before');
    const ref = Cell.source<GpuiElement | null>(null);
    renderer.render(() => <div ref={ref}>{label}</div>);
    const parent = ref.get();
    if (!parent) throw new Error('Expected parent ref to resolve.');
    const text = parent.children[0];
    if (!(text instanceof GpuiText)) throw new Error('Expected text child.');
    const cleanup = vi.fn();
    text.setCleanup('test', cleanup);

    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);
    renderer.append(parent, group);
    renderer.write(handle, [text]);
    renderer.write(handle, []);
    expect(text.parent).toBeNull();
    renderer.flush();
    renderer.write(handle, [text]);
    await new Promise((resolve) => setTimeout(resolve, 1));

    label.set('after');
    expect(collectText(debugTree(renderer))).toEqual(['after']);
    expect(idsByKind(debugTree(renderer), 'Text')).toEqual([text.id]);
    expect(text.content).toBe('after');
    expect(text.destroyed).toBe(false);
    expect(text.lifecycle.signal.aborted).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();

    renderer.write(handle, []);
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(text.destroyed).toBe(true);
    expect(text.lifecycle.signal.aborted).toBe(true);
    expect(text.renderer).toBeUndefined();
    expect(text.host).toBeUndefined();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(idsByKind(debugTree(renderer), 'Text')).toEqual([]);
    const updateText = vi.spyOn(renderer.host, 'updateText');
    label.set('stale');
    renderer.updateText('also stale', text);
    renderer.flush();
    expect(updateText).not.toHaveBeenCalled();
    expect(text.content).toBe('after');
    expect(() => renderer.unmount()).not.toThrow();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('cleans up top-level and never-attached text on unmount', () => {
    const renderer = createRenderer();
    const mounted = renderer.createText('mounted');
    const detached = renderer.createText('detached');
    renderer.render(() => mounted);
    expect(collectText(debugTree(renderer))).toEqual(['mounted']);

    renderer.unmount();
    for (const text of [mounted, detached]) {
      expect(text.destroyed).toBe(true);
      expect(text.lifecycle.signal.aborted).toBe(true);
      expect(text.parent).toBeNull();
      expect(text.renderer).toBeUndefined();
      expect(text.host).toBeUndefined();
    }
    expect(idsByKind(debugTree(renderer), 'Text')).toEqual([]);
  });

  it('keeps native event subscriptions element-only', () => {
    const renderer = createRenderer();
    const text = renderer.createText('listener');
    renderer.render(() => text);
    const subscribe = vi.spyOn(renderer.host, 'subscribeEvent');
    const unsubscribe = vi.spyOn(renderer.host, 'unsubscribeEvent');

    // Text has no native hit-testing, so listeners stay local-only.
    const listener = () => {};
    text.addEventListener('click', listener);
    text.removeEventListener('click', listener);
    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(debugTree(renderer).poisoned).toBe(false);
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

  it('maps textarea value and row bounds through the native property vocabulary', () => {
    const renderer = createRenderer();
    const textareaRef = Cell.source<GpuiTextareaElement | null>(null);
    const value = Cell.source('first\nsecond');
    const placeholder = Cell.source('Notes');
    const minRows = Cell.source(2);
    const maxRows = Cell.source(6);
    const setProperty = vi.spyOn(renderer.host, 'setProperty');

    renderer.render(() => (
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        minRows={minRows}
        maxRows={maxRows}
      />
    ));
    const textarea = textareaRef.get();
    if (!textarea) throw new Error('Expected textarea ref to resolve.');

    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.Value,
      'first\nsecond'
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.MinRows,
      2
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.MaxRows,
      6
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.Placeholder,
      'Notes'
    );

    Cell.batch(() => {
      value.set('updated\nvalue');
      placeholder.set('Comments');
      minRows.set(3);
      maxRows.set(8);
    });
    renderer.flush();
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.Value,
      'updated\nvalue'
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.MinRows,
      3
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.MaxRows,
      8
    );
    expect(setProperty).toHaveBeenCalledWith(
      textarea.id,
      PropertyId.Placeholder,
      'Comments'
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

  it('publishes transition longhands and serializes property arrays compactly', () => {
    const renderer = createRenderer();
    const element = renderer.createContainer('div');
    const setStyle = vi.spyOn(renderer.host, 'setStyle');

    renderer.setProperty(element, 'style', {
      width: 120,
      opacity: 0.5,
      backgroundColor: '#ff0000',
      transitionProperty: ['width', 'opacity', 'backgroundColor'],
      transitionDuration: '.2s',
      transitionDelay: '25ms',
      transitionTimingFunction: 'ease-out',
    } satisfies GpuiStyle);

    expect(setStyle).toHaveBeenCalledWith(element.id, [
      [PropertyId.Width, 120],
      [PropertyId.Opacity, 0.5],
      [PropertyId.BackgroundColor, '#ff0000'],
      [PropertyId.TransitionProperty, 'width,opacity,backgroundColor'],
      [PropertyId.TransitionDuration, '.2s'],
      [PropertyId.TransitionDelay, '25ms'],
      [PropertyId.TransitionTimingFunction, 'ease-out'],
    ]);
  });

  it('publishes logical spacing shorthands through the native style vocabulary', () => {
    const renderer = createRenderer();
    const element = renderer.createContainer('div');
    const setStyle = vi.spyOn(renderer.host, 'setStyle');

    renderer.setProperty(element, 'style', {
      paddingInline: 12,
      paddingBlock: 8,
      marginInline: -4,
      marginBlock: 6,
    } satisfies GpuiStyle);

    expect(setStyle).toHaveBeenCalledWith(element.id, [
      [PropertyId.PaddingInline, 12],
      [PropertyId.PaddingBlock, 8],
      [PropertyId.MarginInline, -4],
      [PropertyId.MarginBlock, 6],
    ]);
  });

  it('publishes native pseudo-state snapshots and nested reactive updates', () => {
    const renderer = createRenderer();
    const ref = Cell.source<GpuiElement | null>(null);
    const hoverOpacity = Cell.source(0.7);
    const setPseudoStyle = vi.spyOn(renderer.host, 'setPseudoStyle');

    renderer.render(() => (
      <div
        ref={ref}
        style={{
          opacity: 1,
          hover: {
            opacity: hoverOpacity,
            transitionProperty: 'opacity',
            transitionDuration: '120ms',
          },
          focused: { opacity: 0.9 },
          active: { opacity: 0.3 },
        }}
      />
    ));
    const target = ref.get();
    if (!target) throw new Error('Expected target ref to resolve.');

    expect(setPseudoStyle).toHaveBeenCalledWith(target.id, StyleState.Hover, [
      [PropertyId.Opacity, 0.7],
      [PropertyId.TransitionProperty, 'opacity'],
      [PropertyId.TransitionDuration, '120ms'],
    ]);
    expect(setPseudoStyle).toHaveBeenCalledWith(target.id, StyleState.Focused, [
      [PropertyId.Opacity, 0.9],
    ]);
    expect(setPseudoStyle).toHaveBeenCalledWith(target.id, StyleState.Active, [
      [PropertyId.Opacity, 0.3],
    ]);

    setPseudoStyle.mockClear();
    hoverOpacity.set(0.8);
    renderer.flush();
    expect(setPseudoStyle).toHaveBeenCalledOnce();
    expect(setPseudoStyle).toHaveBeenCalledWith(target.id, StyleState.Hover, [
      [PropertyId.Opacity, 0.8],
      [PropertyId.TransitionProperty, 'opacity'],
      [PropertyId.TransitionDuration, '120ms'],
    ]);
  });

  it('ignores stale asynchronous property resolutions', async () => {
    const renderer = createRenderer();
    const element = renderer.createContainer('div');
    const pending = Promise.withResolvers<GpuiStyle>();
    const style = Cell.source<unknown>(pending.promise);
    renderer.setProperty(element, 'style', style);

    style.set({ width: 200 });
    pending.resolve({ width: 100 });
    await Promise.resolve();

    expect(element.style.width).toBe(200);
  });

  it('releases a replaced reactive property binding', () => {
    const renderer = createRenderer();
    const element = renderer.createContainer('div');
    const style = Cell.source<GpuiStyle>({ width: 10 });
    renderer.setProperty(element, 'style', style);
    renderer.setProperty(element, 'style', { width: 20 });

    style.set({ width: 30 });

    expect(element.style.width).toBe(20);
  });

  it('keeps a ref assigned when the same cell is set twice', () => {
    const renderer = createRenderer();
    const element = renderer.createContainer('div');
    const ref = Cell.source<GpuiElement | null>(null);
    renderer.setProperty(element, 'ref', ref);
    renderer.setProperty(element, 'ref', ref);

    expect(ref.peek()).toBe(element);
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

  it('recovers a component boundary after a failed HMR render', () => {
    const renderer = createRenderer({ hmr: true });

    const label = Cell.source('before');
    function App() {
      return <div>{label}</div>;
    }
    function BrokenApp() {
      throw new Error('broken update');
    }
    function FixedApp() {
      return <div>after</div>;
    }

    renderer.render(() => <App />);
    expect(collectText(debugTree(renderer))).toEqual(['before']);

    hotReloadModule({ default: BrokenApp }, { default: App });
    expect(collectText(debugTree(renderer)).join('')).toContain(
      'broken update'
    );
    expect(collectText(debugTree(renderer))).toContain('before');

    label.set('still alive');
    expect(collectText(debugTree(renderer))).toContain('still alive');

    hotReloadModule({ default: FixedApp }, { default: BrokenApp });
    expect(collectText(debugTree(renderer))).toEqual(['after']);
  });

  it('discards nodes created by a failing HMR render without disturbing committed ones', () => {
    const renderer = createRenderer({ hmr: true });
    let speculative!: GpuiElement;

    function App() {
      return <div>before</div>;
    }
    function BrokenApp() {
      speculative = renderer.createContainer('div');
      throw new Error('broken after creating a node');
    }
    function FixedApp() {
      return <div>after</div>;
    }

    renderer.render(() => <App />);

    hotReloadModule({ default: BrokenApp }, { default: App });
    const failed = debugTree(renderer);
    expect(collectText(failed)).toContain('before');
    expect(speculative.destroyed).toBe(true);

    hotReloadModule({ default: FixedApp }, { default: BrokenApp });
    expect(collectText(debugTree(renderer))).toEqual(['after']);
  });

  it('rolls back every node created inside a failed operation', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>base</div>);
    const baseIds = debugTree(renderer)
      .nodes.map((node) => node.id)
      .toSorted();

    expect(() =>
      renderer.withNodeRollback(() => {
        const outer = renderer.createContainer('div');
        renderer.append(outer, renderer.createText('rollback candidate'));
        throw new Error('speculative failure');
      })
    ).toThrow('speculative failure');

    const after = debugTree(renderer);
    expect(after.nodes.map((node) => node.id).toSorted()).toEqual(baseIds);
    expect(collectText(after)).toEqual(['base']);
  });

  it('keeps nested rollback scopes independent of committed nodes', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>base</div>);

    let innerFailed = false;
    expect(() =>
      renderer.withNodeRollback(() => {
        const outer = renderer.createContainer('div');
        renderer.append(outer, renderer.createText('outer'));
        try {
          renderer.withNodeRollback(() => {
            const inner = renderer.createContainer('div');
            renderer.append(inner, renderer.createText('inner'));
            throw new Error('inner failure');
          });
        } catch {
          innerFailed = true;
        }
        throw new Error('outer failure');
      })
    ).toThrow('outer failure');

    expect(innerFailed).toBe(true);
    expect(collectText(debugTree(renderer))).toEqual(['base']);
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

  it('shows an error overlay above the application subtree', () => {
    const renderer = createRenderer();
    const appRef = Cell.source<GpuiElement | null>(null);
    renderer.render(() => <div ref={appRef}>application</div>);
    const app = appRef.get();
    if (!app) throw new Error('Expected application ref to resolve.');

    renderer.showDevelopmentError(new Error('broken update'));
    let tree = debugTree(renderer);
    expect(collectText(tree)).toContain('application');
    expect(collectText(tree).join('')).toContain('broken update');
    expect(tree.nodes.some((node) => node.id === app.id)).toBe(true);
    expect(tree.pending_detached).not.toContain(app.id);

    renderer.clearDevelopmentError();
    tree = debugTree(renderer);
    expect(collectText(tree)).toEqual(['application']);
    expect(tree.pending_detached).not.toContain(app.id);
  });

  it('strips terminal control sequences from development errors', () => {
    const renderer = createRenderer();

    renderer.showDevelopmentError('\u001b[31mparse failed\u001b[0m');
    const text = collectText(debugTree(renderer)).join('');

    expect(text).toContain('parse failed');
    expect(text).not.toContain('\u001b');
    expect(text).not.toContain('[31m');
  });

  it('structures Vite diagnostics into message, source, frame, and stack sections', () => {
    const renderer = createRenderer();
    const error = Object.assign(new Error('Failed to resolve import'), {
      plugin: 'vite:import-analysis',
      id: '/source/app.tsx',
      loc: { line: 27, column: 10 },
      frame: '25 | const value = 1;\n26 | import Missing from "./missing";',
    });
    error.stack = `${error.message}\n    at transformRequest (/vite/node.js:10:4)`;

    renderer.showDevelopmentError(error);
    const text = collectText(debugTree(renderer)).join('\n');

    expect(text).toContain(
      '[plugin:vite:import-analysis] Failed to resolve import'
    );
    expect(text).toContain('/source/app.tsx:27:10');
    expect(text).toContain('26 | import Missing from "./missing";');
    expect(text).toContain('at transformRequest (/vite/node.js:10:4)');
    expect(text).toContain('Fix the code to dismiss this overlay.');
  });

  it('presents the development overlay before an application root mounts', () => {
    const renderer = createRenderer();

    renderer.showDevelopmentError(new Error('early failure'));
    expect(collectText(debugTree(renderer)).join('')).toContain(
      'early failure'
    );

    renderer.render(() => <div>application</div>);
    const tree = debugTree(renderer);
    expect(collectText(tree)).toContain('application');
    expect(collectText(tree).join('')).toContain('early failure');

    renderer.clearDevelopmentError();
    expect(collectText(debugTree(renderer))).toEqual(['application']);
  });

  it('keeps the development overlay above roots added while it is visible', () => {
    const renderer = createRenderer();
    const extra = Cell.source(false);

    renderer.render(() => (
      <>
        <div>main</div>
        {If(extra, () => (
          <div>extra</div>
        ))}
      </>
    ));
    renderer.showDevelopmentError(new Error('late failure'));

    extra.set(true);
    const texts = collectText(debugTree(renderer));
    expect(texts.join('')).toContain('extra');
    // New roots insert before the overlay so it keeps painting above them.
    expect(texts.indexOf('late failure')).toBeGreaterThan(
      texts.indexOf('extra')
    );

    extra.set(false);
    renderer.clearDevelopmentError();
    expect(collectText(debugTree(renderer))).toEqual(['main']);
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

    renderer.host.createNode(ElementKind.Root);
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

    renderer.host.createNode(ElementKind.Root);
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
    expect(collectText(debugTree(renderer))).toContain('render failed');
  });

  it('does not leave a partial development overlay on a fatal renderer', () => {
    const renderer = createRenderer();
    renderer.render(() => <div>mounted</div>);
    renderer.host.createNode(ElementKind.Root);
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

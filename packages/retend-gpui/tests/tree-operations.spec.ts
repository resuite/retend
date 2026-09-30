import { afterEach, describe, expect, it } from 'vitest';

import {
  appendNodes,
  createRange,
  writeRange,
} from '../source/tree/operations';
import { createRenderer, debugTree, disposeRenderers } from './helpers';

afterEach(disposeRenderers);

const CYCLE = 'cannot be inserted into itself or one of its descendants';

/** A mounted `outer > middle > inner` chain of `<div>` elements. */
function mountedChain() {
  const renderer = createRenderer();
  const outer = renderer.createContainer('div');
  const middle = renderer.createContainer('div');
  const inner = renderer.createContainer('div');
  appendNodes(outer, middle);
  appendNodes(middle, inner);
  renderer.render(() => outer);
  return { renderer, outer, middle, inner };
}

describe('logical tree insertion', () => {
  it('rejects moving a node under itself or its descendants, leaving both trees intact', () => {
    const { renderer, outer, middle, inner } = mountedChain();

    expect(() => appendNodes(middle, middle)).toThrow(CYCLE);
    expect(() => appendNodes(inner, middle)).toThrow(CYCLE);
    expect(() => appendNodes(inner, outer)).toThrow(CYCLE);

    expect(outer.children).toEqual([middle]);
    expect(middle.children).toEqual([inner]);
    expect(inner.children).toEqual([]);
    expect(debugTree(renderer).poisoned).toBe(false);
  });

  it('rejects a group that flattens to the parent before detaching the group', () => {
    const { renderer, middle } = mountedChain();
    const group = renderer.createGroup();
    appendNodes(group, middle);

    expect(() => appendNodes(middle, group)).toThrow(CYCLE);

    expect(group.children).toEqual([middle]);
    expect(middle.parent).toBe(group);
    expect(debugTree(renderer).poisoned).toBe(false);
  });

  it('rejects a group whose content is an ancestor of the parent', () => {
    const { renderer, outer, inner } = mountedChain();
    const group = renderer.createGroup();
    appendNodes(group, outer);

    expect(() => appendNodes(inner, [group])).toThrow(CYCLE);

    expect(group.children).toEqual([outer]);
    expect(inner.children).toEqual([]);
    expect(debugTree(renderer).poisoned).toBe(false);
  });

  it('rejects range content that contains the range group itself', () => {
    const renderer = createRenderer();
    const group = renderer.createGroup();
    const range = createRange(group);
    const content = renderer.createContainer('div');
    writeRange(range, [content]);

    // Flattening the group would first strip its own anchors and content.
    expect(() => writeRange(range, [group])).toThrow(CYCLE);

    expect(group.children).toEqual([range[0], content, range[1]]);
    expect(content.parent).toBe(group);
  });
});

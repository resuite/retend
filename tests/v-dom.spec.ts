import { VWindow } from 'retend-server/v-dom';
import { describe, expect, it } from 'vitest';

describe('VDOM node ownership', () => {
  it('detaches moved nodes before replaceWith()', () => {
    const window = new VWindow();
    const source = window.document.createElement('div');
    const targetParent = window.document.createElement('section');
    const moved = window.document.createElement('span');
    const target = window.document.createElement('p');

    source.append(moved);
    targetParent.append(target);

    target.replaceWith(moved);

    expect(source.childNodes).toEqual([]);
    expect(targetParent.childNodes).toEqual([moved]);
    expect(moved.parentNode).toBe(targetParent);
    expect(target.parentNode).toBeNull();
  });

  it('detaches moved nodes before replaceChildren()', () => {
    const window = new VWindow();
    const source = window.document.createElement('div');
    const target = window.document.createElement('section');
    const moved = window.document.createElement('span');
    const oldChild = window.document.createElement('p');

    source.append(moved);
    target.append(oldChild);

    target.replaceChildren(moved);

    expect(source.childNodes).toEqual([]);
    expect(target.childNodes).toEqual([moved]);
    expect(moved.parentNode).toBe(target);
    expect(oldChild.parentNode).toBeNull();
  });
});

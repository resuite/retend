import { describe, expect, expectTypeOf, it } from 'vitest';

import { GpuiElement, GpuiNode, GpuiText } from '../source/gpui-renderer';
import { GpuiParentNode } from '../source/tree/nodes';

const elementOnlyKeys = [
  'measure',
  'focus',
  'blur',
  'scrollTo',
  'scrollBy',
  'scrollIntoView',
  'getScrollOffset',
  'style',
  'children',
  'tagName',
  'acceptsChildren',
] as const;

describe('GpuiText boundary', () => {
  it('extends GpuiNode directly without element or parent APIs', () => {
    const text = new GpuiText(1, 'plain');

    expect(text).toBeInstanceOf(GpuiNode);
    expect(text).not.toBeInstanceOf(GpuiElement);
    expect(text).not.toBeInstanceOf(GpuiParentNode);
    for (const key of elementOnlyKeys) expect(key in text).toBe(false);
    expect(text.id).toBe(1);
    expect(text.content).toBe('plain');

    expectTypeOf<GpuiText>().toExtend<GpuiNode>();
    expectTypeOf<GpuiText>().not.toExtend<GpuiElement>();
    expectTypeOf<GpuiText>().not.toExtend<GpuiParentNode>();
    expectTypeOf<
      Extract<keyof GpuiText, (typeof elementOnlyKeys)[number]>
    >().toBeNever();
  });
});

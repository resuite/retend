import { describe, expectTypeOf, it } from 'vitest';

import type { GpuiElement, GpuiNode, GpuiText } from '../source/gpui-renderer';
import type { GpuiParentNode } from '../source/tree/nodes';

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
  it('keeps element-only APIs off the text type', () => {
    expectTypeOf<GpuiText>().toExtend<GpuiNode>();
    expectTypeOf<GpuiText>().not.toExtend<GpuiElement>();
    expectTypeOf<GpuiText>().not.toExtend<GpuiParentNode>();
    expectTypeOf<
      Extract<keyof GpuiText, (typeof elementOnlyKeys)[number]>
    >().toBeNever();
  });
});

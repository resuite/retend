import { BoxRenderable, Renderable } from '@opentui/core';

export class _FragmentRenderable extends BoxRenderable {
  __isFragment = true;
}
export class _AnchorRenderable extends Renderable {
  constructor(...args: ConstructorParameters<typeof Renderable>) {
    const [ctx, options] = args;
    super(ctx, { ...options, visible: false });
  }

  __isHidden = true;
}
export type RenderableRange = [_AnchorRenderable, _AnchorRenderable];

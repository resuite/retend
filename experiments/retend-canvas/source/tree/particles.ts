import type { FrameBuilder } from '../frame-builder';
import type { CanvasParticlesProps } from '../types';

import { CanvasRect } from './container';

export class CanvasParticles extends CanvasRect<CanvasParticlesProps> {
  override paintContainer(frame: FrameBuilder): void {
    super.paintContainer(frame);

    const host = this.renderer.host;
    const { positions, colorMap, sizeMap, shape = 'circle' } = this.attributes;

    if (!positions || positions.length === 0) return;

    const hasColorMap = Array.isArray(colorMap);
    const hasSizeMap =
      sizeMap instanceof Float32Array || Array.isArray(sizeMap);
    const baseColor =
      !hasColorMap && colorMap ? colorMap : host.getCascadedValue('color');
    const baseSize = !hasSizeMap && sizeMap !== undefined ? sizeMap : 2;
    frame.pushParticles(
      {
        positions,
        colorMap,
        sizeMap,
        shape,
        baseColor,
        baseSize,
      },
      this.id
    );
  }
}

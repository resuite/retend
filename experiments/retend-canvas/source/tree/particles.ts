import type { ColorBatch, FrameBuilder } from '../frame-builder';
import type { CanvasParticlesProps } from '../types';

import { CanvasRect } from './container';

export class CanvasParticles extends CanvasRect<CanvasParticlesProps> {
  #cachedPositions?: Float32Array | number[];
  #cachedColorMap?: string | string[];
  #cachedBaseColor = '';
  #cachedColorBatches?: ColorBatch[];

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

    let colorBatches = this.#cachedColorBatches;
    if (
      this.#cachedPositions !== positions ||
      this.#cachedColorMap !== colorMap ||
      this.#cachedBaseColor !== baseColor
    ) {
      this.#cachedPositions = positions;
      this.#cachedColorMap = colorMap;
      this.#cachedBaseColor = baseColor;
      if (hasColorMap) {
        colorBatches = [];
        const batchMap = new Map<string, number[]>();
        for (let i = 0; i < positions.length; i += 2) {
          let color = baseColor;
          if (colorMap[i / 2]) color = colorMap[i / 2];
          const batch = batchMap.get(color);
          if (batch) {
            batch.push(i);
            continue;
          }
          batchMap.set(color, [i]);
        }
        for (const [color, indices] of batchMap) {
          colorBatches.push({ color, indices });
        }
      } else {
        colorBatches = undefined;
      }
      this.#cachedColorBatches = colorBatches;
    }

    frame.pushParticles(
      {
        positions,
        sizeMap,
        shape,
        baseColor,
        baseSize,
        colorBatches,
      },
      this.id
    );
  }
}

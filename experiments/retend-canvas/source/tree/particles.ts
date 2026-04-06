import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

import { CanvasRect } from './container';

export class CanvasParticles extends CanvasRect<JSX.ParticlesProps> {
  constructor(renderer: CanvasRenderer) {
    super(renderer);
  }

  override drawContainer(): void {
    super.drawContainer(); // Paints background and borders for root container

    const host = this.renderer.host;
    const { positions, colorMap, sizeMap, shape = 'circle' } = this.attributes;

    if (!positions || positions.length === 0) return;

    const isRect = shape === 'rect';

    // Fast path bounds checks
    const isUniformColor = typeof colorMap === 'string' || !colorMap;
    const isUniformSize = typeof sizeMap === 'number' || !sizeMap;

    const baseColor = isUniformColor
      ? (colorMap as string) || host.color
      : host.color;
    const baseSize = isUniformSize ? ((sizeMap as number) ?? 2) : 2;

    if (isUniformColor) {
      host.ctx.fillStyle = baseColor;
      host.ctx.beginPath();

      for (let i = 0; i < positions.length; i += 2) {
        const cx = positions[i];
        const cy = positions[i + 1];
        const r = isUniformSize
          ? baseSize
          : (sizeMap as Float32Array | number[])[i / 2];

        if (isRect) {
          host.ctx.rect(cx - r, cy - r, r * 2, r * 2);
        } else {
          host.ctx.moveTo(cx + r, cy);
          host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      host.ctx.fill();
    } else {
      // Slower path: Per-particle color assignments
      const colors = colorMap as string[];
      for (let i = 0; i < positions.length; i += 2) {
        const cx = positions[i];
        const cy = positions[i + 1];
        const r = isUniformSize
          ? baseSize
          : (sizeMap as Float32Array | number[])[i / 2];
        const color = colors[i / 2] || baseColor;

        host.ctx.fillStyle = color;
        host.ctx.beginPath();
        if (isRect) {
          host.ctx.rect(cx - r, cy - r, r * 2, r * 2);
        } else {
          host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        host.ctx.fill();
      }
    }
  }
}

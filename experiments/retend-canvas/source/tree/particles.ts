import type { JSX } from 'retend/jsx-runtime';

import { CanvasRect } from './container';

export class CanvasParticles extends CanvasRect<JSX.ParticlesProps> {
  override drawContainer(): void {
    super.drawContainer(); // Paints background and borders for root container

    const host = this.renderer.host;
    const { positions, colorMap, sizeMap, shape = 'circle' } = this.attributes;

    if (!positions || positions.length === 0) return;

    const isRect = shape === 'rect';
    const hasColorMap = Array.isArray(colorMap);
    const hasSizeMap =
      sizeMap instanceof Float32Array || Array.isArray(sizeMap);
    const baseColor = !hasColorMap && colorMap ? colorMap : host.color;
    const baseSize = !hasSizeMap && sizeMap !== undefined ? sizeMap : 2;

    if (!hasColorMap) {
      host.ctx.fillStyle = baseColor;
      host.ctx.beginPath();

      for (let i = 0; i < positions.length; i += 2) {
        const cx = positions[i];
        const cy = positions[i + 1];
        const r = hasSizeMap ? sizeMap[i / 2] : baseSize;

        if (isRect) {
          host.ctx.rect(cx - r, cy - r, r * 2, r * 2);
        } else {
          host.ctx.moveTo(cx + r, cy);
          host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      host.ctx.fill();
    } else {
      const colorBatches = new Map<string, number[]>();
      for (let i = 0; i < positions.length; i += 2) {
        const color = colorMap[i / 2] ? colorMap[i / 2] : baseColor;
        const batch = colorBatches.get(color);
        if (batch) {
          batch.push(i);
          continue;
        }
        colorBatches.set(color, [i]);
      }

      for (const [color, batch] of colorBatches) {
        host.ctx.fillStyle = color;
        host.ctx.beginPath();

        for (const i of batch) {
          const cx = positions[i];
          const cy = positions[i + 1];
          const r = hasSizeMap ? sizeMap[i / 2] : baseSize;

          if (isRect) {
            host.ctx.rect(cx - r, cy - r, r * 2, r * 2);
          } else {
            host.ctx.moveTo(cx + r, cy);
            host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
          }
        }

        host.ctx.fill();
      }
    }
  }
}

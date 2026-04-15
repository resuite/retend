import {
  CommandKind,
  type FrameBuilder,
  type FrameCommand,
  type ResolvedShadow,
} from './frame-builder';
import { nodeIdToRgb } from './tree';

const invertedPathCache = new WeakMap<Path2D, Path2D>();

export function replay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  commands: FrameCommand[],
  frame: FrameBuilder,
  isHit = false
) {
  ctx.save();
  ctx.setTransform(isHit ? new DOMMatrix() : ctx.getTransform());

  for (const command of commands) {
    const payloadIndex = command.payload;
    switch (command.kind) {
      case CommandKind.Save:
        ctx.save();
        break;
      case CommandKind.Restore:
        ctx.restore();
        break;
      case CommandKind.Transform: {
        const m = frame.transforms[payloadIndex];
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        break;
      }
      case CommandKind.Alpha:
        ctx.globalAlpha *= frame.alphas[payloadIndex];
        break;
      case CommandKind.Clip:
        ctx.clip(frame.clips[payloadIndex]);
        break;
      case CommandKind.PathFill: {
        const payload = frame.pathFills[payloadIndex];
        if (isHit) {
          ctx.fillStyle = nodeIdToRgb(command.nodeId);
          ctx.fill(payload.path);
          break;
        }

        for (const shadow of payload.dropShadows) {
          ctx.save();
          ctx.clip(invertedPath(payload.path, ctx.canvas), 'evenodd');
          applyShadow(ctx, shadow);
          ctx.fillStyle = 'black';
          ctx.fill(payload.path);
          ctx.restore();
        }

        ctx.fillStyle = payload.fillStyle;
        ctx.fill(payload.path);

        for (const shadow of payload.insetShadows) {
          ctx.save();
          ctx.clip(payload.path);
          applyShadow(ctx, shadow);
          ctx.fillStyle = shadow.color;
          ctx.fill(invertedPath(payload.path, ctx.canvas), 'evenodd');
          ctx.restore();
        }
        break;
      }
      case CommandKind.PathStroke: {
        const payload = frame.pathStrokes[payloadIndex];
        ctx.lineWidth = payload.lineWidth;
        ctx.strokeStyle = isHit
          ? nodeIdToRgb(command.nodeId)
          : payload.strokeStyle;
        ctx.setLineDash(payload.lineDash);
        ctx.stroke(payload.path);
        break;
      }
      case CommandKind.Image: {
        const payload = frame.images[payloadIndex];
        ctx.drawImage(payload.image, 0, 0, payload.width, payload.height);
        break;
      }
      case CommandKind.TextLine: {
        const payload = frame.textLines[payloadIndex];
        ctx.textBaseline = 'top';
        ctx.font = payload.font;
        ctx.fillStyle = payload.fillStyle;
        ctx.fillText(payload.text, payload.x, payload.y);
        break;
      }
      case CommandKind.Particles: {
        const payload = frame.particles[payloadIndex];
        const { positions, colorBatches, sizeMap, shape, baseColor, baseSize } =
          payload;
        const isRect = shape === 'rect';
        const hasSizeMap =
          sizeMap instanceof Float32Array || Array.isArray(sizeMap);
        const drawAt = (i: number, r: number) => {
          if (isRect)
            ctx.rect(positions[i] - r, positions[i + 1] - r, r * 2, r * 2);
          else {
            ctx.moveTo(positions[i] + r, positions[i + 1]);
            ctx.arc(positions[i], positions[i + 1], r, 0, Math.PI * 2);
          }
        };

        if (!colorBatches) {
          ctx.fillStyle = baseColor;
          ctx.beginPath();
          for (let i = 0; i < positions.length; i += 2)
            drawAt(i, hasSizeMap ? sizeMap[i / 2] : baseSize);
          ctx.fill();
        } else {
          for (const { color, indices } of colorBatches) {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (const i of indices)
              drawAt(i, hasSizeMap ? sizeMap[i / 2] : baseSize);
            ctx.fill();
          }
        }
        break;
      }
    }
  }
  ctx.restore();
}

interface Viewport {
  width: number;
  height: number;
}

function invertedPath(path: Path2D, viewport: Viewport) {
  const inverted = invertedPathCache.get(path);
  if (inverted) return inverted;
  const p = new Path2D();
  p.rect(-10000, -10000, viewport.width + 20000, viewport.height + 20000);
  p.addPath(path);
  invertedPathCache.set(path, p);
  return p;
}

function applyShadow(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shadow: ResolvedShadow
) {
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;
  ctx.shadowBlur = shadow.blur;
  ctx.shadowColor = shadow.color;
}

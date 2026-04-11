export const CommandKind = {
  Save: 0,
  Restore: 1,
  Transform: 2,
  Alpha: 3,
  Clip: 4,
  PathFill: 5,
  PathStroke: 6,
  Image: 7,
  TextLine: 8,
  Particles: 9,
} as const;

export type FrameCommand = {
  kind: (typeof CommandKind)[keyof typeof CommandKind];
  payload: number;
  nodeId: number;
};

export type ResolvedShadow = {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
};

export type PathFillPayload = {
  path: Path2D;
  fillStyle: string;
  dropShadows: ResolvedShadow[];
  insetShadows: ResolvedShadow[];
};

export type PathStrokePayload = {
  path: Path2D;
  strokeStyle: string;
  lineWidth: number;
  lineDash: number[];
};

export type ImagePayload = {
  image: ImageBitmap;
  width: number;
  height: number;
};

export type TextLinePayload = {
  text: string;
  x: number;
  y: number;
  font: string;
  fillStyle: string;
};

export type ColorBatch = {
  color: string;
  indices: number[];
};

export type ParticlesPayload = {
  positions: Float32Array | number[];
  sizeMap?: number | Float32Array | number[];
  shape: 'circle' | 'rect';
  baseColor: string;
  baseSize: number;
  colorBatches?: ColorBatch[];
};

export class FrameBuilder {
  shouldPaintHitCanvas = false;
  commands: FrameCommand[] = [];
  hitCommands: FrameCommand[] = [];
  transforms: DOMMatrix[] = [];
  alphas: number[] = [];
  clips: Path2D[] = [];
  pathFills: PathFillPayload[] = [];
  pathStrokes: PathStrokePayload[] = [];
  images: ImagePayload[] = [];
  textLines: TextLinePayload[] = [];
  particles: ParticlesPayload[] = [];

  reset(shouldPaintHitCanvas: boolean) {
    this.shouldPaintHitCanvas = shouldPaintHitCanvas;
    this.commands.length = 0;
    this.hitCommands.length = 0;
    this.transforms.length = 0;
    this.alphas.length = 0;
    this.clips.length = 0;
    this.pathFills.length = 0;
    this.pathStrokes.length = 0;
    this.images.length = 0;
    this.textLines.length = 0;
    this.particles.length = 0;
  }

  pushSave() {
    this.commands.push({ kind: CommandKind.Save, payload: -1, nodeId: 0 });
    if (this.shouldPaintHitCanvas) {
      this.hitCommands.push({ kind: CommandKind.Save, payload: -1, nodeId: 0 });
    }
  }

  pushRestore() {
    this.commands.push({ kind: CommandKind.Restore, payload: -1, nodeId: 0 });
    if (this.shouldPaintHitCanvas) {
      this.hitCommands.push({
        kind: CommandKind.Restore,
        payload: -1,
        nodeId: 0,
      });
    }
  }

  pushTransform(transform: DOMMatrix | null) {
    if (!transform) return;
    this.transforms.push(transform);
    const payload = this.transforms.length - 1;
    this.commands.push({ kind: CommandKind.Transform, payload, nodeId: 0 });
    if (this.shouldPaintHitCanvas) {
      this.hitCommands.push({
        kind: CommandKind.Transform,
        payload,
        nodeId: 0,
      });
    }
  }

  pushAlpha(opacity: number) {
    if (opacity === 1) return;
    this.alphas.push(opacity);
    this.commands.push({
      kind: CommandKind.Alpha,
      payload: this.alphas.length - 1,
      nodeId: 0,
    });
  }

  pushClip(path: Path2D | null) {
    if (!path) return;
    this.clips.push(path);
    const payload = this.clips.length - 1;
    this.commands.push({ kind: CommandKind.Clip, payload, nodeId: 0 });
    if (this.shouldPaintHitCanvas) {
      this.hitCommands.push({ kind: CommandKind.Clip, payload, nodeId: 0 });
    }
  }

  pushPathFill(payload: PathFillPayload, nodeId: number) {
    this.pathFills.push(payload);
    this.commands.push({
      kind: CommandKind.PathFill,
      payload: this.pathFills.length - 1,
      nodeId,
    });
  }

  pushHitPathFill(path: Path2D, nodeId: number) {
    if (!this.shouldPaintHitCanvas) return;
    this.pathFills.push({
      path,
      fillStyle: '',
      dropShadows: [],
      insetShadows: [],
    });
    this.hitCommands.push({
      kind: CommandKind.PathFill,
      payload: this.pathFills.length - 1,
      nodeId,
    });
  }

  pushPathStroke(payload: PathStrokePayload, nodeId: number) {
    this.pathStrokes.push(payload);
    this.commands.push({
      kind: CommandKind.PathStroke,
      payload: this.pathStrokes.length - 1,
      nodeId,
    });
  }

  pushHitPathStroke(payload: PathStrokePayload, nodeId: number) {
    if (!this.shouldPaintHitCanvas) return;
    this.pathStrokes.push(payload);
    this.hitCommands.push({
      kind: CommandKind.PathStroke,
      payload: this.pathStrokes.length - 1,
      nodeId,
    });
  }

  pushImage(payload: ImagePayload, nodeId: number) {
    this.images.push(payload);
    this.commands.push({
      kind: CommandKind.Image,
      payload: this.images.length - 1,
      nodeId,
    });
  }

  pushTextLine(payload: TextLinePayload, nodeId: number) {
    this.textLines.push(payload);
    this.commands.push({
      kind: CommandKind.TextLine,
      payload: this.textLines.length - 1,
      nodeId,
    });
  }

  pushParticles(payload: ParticlesPayload, nodeId: number) {
    this.particles.push(payload);
    this.commands.push({
      kind: CommandKind.Particles,
      payload: this.particles.length - 1,
      nodeId,
    });
  }
}

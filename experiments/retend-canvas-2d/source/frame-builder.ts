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

const RESET_KEYS = [
  'commands',
  'hitCommands',
  'transforms',
  'alphas',
  'clips',
  'pathFills',
  'pathStrokes',
  'images',
  'textLines',
  'particles',
] as const;

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

  reset() {
    this.shouldPaintHitCanvas = true;
    for (const k of RESET_KEYS) (this[k] as unknown[]).length = 0;
  }

  private push(cmd: FrameCommand) {
    this.commands.push(cmd);
    if (this.shouldPaintHitCanvas) this.hitCommands.push(cmd);
  }

  private pushPayload<T>(
    store: T[],
    kind: (typeof CommandKind)[keyof typeof CommandKind],
    item: T,
    nodeId: number
  ) {
    store.push(item);
    this.commands.push({ kind, payload: store.length - 1, nodeId });
  }

  pushSave() {
    this.push({ kind: CommandKind.Save, payload: -1, nodeId: 0 });
  }

  pushRestore() {
    this.push({ kind: CommandKind.Restore, payload: -1, nodeId: 0 });
  }

  pushTransform(transform: DOMMatrix | null) {
    if (!transform) return;
    this.transforms.push(transform);
    this.push({
      kind: CommandKind.Transform,
      payload: this.transforms.length - 1,
      nodeId: 0,
    });
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
    this.push({
      kind: CommandKind.Clip,
      payload: this.clips.length - 1,
      nodeId: 0,
    });
  }

  pushPathFill(payload: PathFillPayload, nodeId: number) {
    this.pushPayload(this.pathFills, CommandKind.PathFill, payload, nodeId);
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
    this.pushPayload(this.pathStrokes, CommandKind.PathStroke, payload, nodeId);
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
    this.pushPayload(this.images, CommandKind.Image, payload, nodeId);
  }

  pushTextLine(payload: TextLinePayload, nodeId: number) {
    this.pushPayload(this.textLines, CommandKind.TextLine, payload, nodeId);
  }

  pushParticles(payload: ParticlesPayload, nodeId: number) {
    this.pushPayload(this.particles, CommandKind.Particles, payload, nodeId);
  }
}

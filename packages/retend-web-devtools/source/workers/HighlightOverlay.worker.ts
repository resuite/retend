interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HighlightColor = 'blue' | 'pink' | 'green' | 'red' | 'amber';

interface CursorPosition {
  x: number;
  y: number;
}

interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  dpr: number;
}

interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
  dpr: number;
}

interface TargetMessage {
  type: 'target';
  rect: Rect | null;
  label: string;
  color: HighlightColor;
}

interface CursorMessage {
  type: 'cursor';
  position: CursorPosition | null;
  color: HighlightColor;
}

interface DisposeMessage {
  type: 'dispose';
}

type WorkerMessage =
  | InitMessage
  | ResizeMessage
  | TargetMessage
  | CursorMessage
  | DisposeMessage;

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let targetRect: Rect | null = null;
let currentRect: Rect | null = null;
let label = '';
let timer: ReturnType<typeof setInterval> | 0 = 0;
let color: HighlightColor = 'blue';
let cursorPosition: CursorPosition | null = null;
let cursorColor: HighlightColor = 'blue';

function syncCanvasSize() {
  if (!canvas) return;
  if (!context) return;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFrame() {
  if (!context) return;
  context.clearRect(0, 0, width, height);

  // Draw crosshair lines first (when picker is active, even if no target)
  if (cursorPosition) {
    let cursorStrokeStyle = 'rgba(66, 153, 225, 0.5)';

    if (cursorColor === 'pink') {
      cursorStrokeStyle = 'rgba(236, 72, 153, 0.5)';
    }

    if (cursorColor === 'green') {
      cursorStrokeStyle = 'rgba(34, 197, 94, 0.5)';
    }

    if (cursorColor === 'red') {
      cursorStrokeStyle = 'rgba(239, 68, 68, 0.5)';
    }

    if (cursorColor === 'amber') {
      cursorStrokeStyle = 'rgba(245, 158, 11, 0.5)';
    }

    context.strokeStyle = cursorStrokeStyle;
    context.lineWidth = 1.1;

    // Horizontal line (full width at cursor Y position)
    context.beginPath();
    context.moveTo(0, cursorPosition.y);
    context.lineTo(width, cursorPosition.y);
    context.stroke();

    // Vertical line (full height at cursor X position)
    context.beginPath();
    context.moveTo(cursorPosition.x, 0);
    context.lineTo(cursorPosition.x, height);
    context.stroke();

    context.lineWidth = 1;
  }

  if (!targetRect) {
    currentRect = null;
    // Keep loop running if cursor position exists (picker active)
    if (!cursorPosition) {
      stopLoop();
    }
    return;
  }

  if (!currentRect) {
    currentRect = {
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
    };
  } else {
    currentRect = {
      x: currentRect.x + (targetRect.x - currentRect.x) * 0.3,
      y: currentRect.y + (targetRect.y - currentRect.y) * 0.3,
      width: currentRect.width + (targetRect.width - currentRect.width) * 0.3,
      height:
        currentRect.height + (targetRect.height - currentRect.height) * 0.3,
    };
  }

  let fillStyle = 'rgba(66, 153, 225, 0.4)';
  let strokeStyle = 'rgba(66, 153, 225, 0.8)';
  let outerStrokeStyle = 'rgba(30, 90, 160, 0.95)';
  let labelFillStyle = 'rgba(66, 153, 225, 0.95)';

  if (color === 'pink') {
    fillStyle = 'rgba(236, 72, 153, 0.35)';
    strokeStyle = 'rgba(236, 72, 153, 0.85)';
    outerStrokeStyle = 'rgba(160, 40, 100, 0.95)';
    labelFillStyle = 'rgba(236, 72, 153, 0.95)';
  }

  if (color === 'green') {
    fillStyle = 'rgba(34, 197, 94, 0.32)';
    strokeStyle = 'rgba(34, 197, 94, 0.82)';
    outerStrokeStyle = 'rgba(16, 120, 56, 0.95)';
    labelFillStyle = 'rgba(34, 197, 94, 0.95)';
  }

  if (color === 'red') {
    fillStyle = 'rgba(239, 68, 68, 0.34)';
    strokeStyle = 'rgba(239, 68, 68, 0.85)';
    outerStrokeStyle = 'rgba(160, 30, 30, 0.95)';
    labelFillStyle = 'rgba(239, 68, 68, 0.95)';
  }

  if (color === 'amber') {
    fillStyle = 'rgba(245, 158, 11, 0.34)';
    strokeStyle = 'rgba(245, 158, 11, 0.85)';
    outerStrokeStyle = 'rgba(160, 100, 5, 0.95)';
    labelFillStyle = 'rgba(245, 158, 11, 0.95)';
  }

  context.fillStyle = fillStyle;
  context.lineWidth = 1;

  context.fillRect(
    currentRect.x,
    currentRect.y,
    currentRect.width,
    currentRect.height
  );

  context.strokeStyle = outerStrokeStyle;
  context.strokeRect(
    currentRect.x - 1,
    currentRect.y - 1,
    currentRect.width + 2,
    currentRect.height + 2
  );

  context.strokeStyle = strokeStyle;
  context.strokeRect(
    currentRect.x,
    currentRect.y,
    currentRect.width,
    currentRect.height
  );

  const boxWidth = Math.round(Math.max(0, targetRect.width));
  const boxHeight = Math.round(Math.max(0, targetRect.height));
  let nameText = label;
  const sizeText = `${boxWidth}x${boxHeight}`;

  const rectLeft = currentRect.x;
  const rectTop = currentRect.y;
  const rectRight = currentRect.x + currentRect.width;
  const rectBottom = currentRect.y + currentRect.height;

  let horizontal = '';
  let vertical = '';
  let direction = '';

  if (rectRight < 0) {
    horizontal = 'left';
  }

  if (rectLeft > width) {
    horizontal = 'right';
  }

  if (rectBottom < 0) {
    vertical = 'up';
  }

  if (rectTop > height) {
    vertical = 'down';
  }

  if (vertical === 'up' && horizontal === 'left') {
    direction = '↖';
  }

  if (vertical === 'up' && horizontal === 'right') {
    direction = '↗';
  }

  if (vertical === 'down' && horizontal === 'left') {
    direction = '↙';
  }

  if (vertical === 'down' && horizontal === 'right') {
    direction = '↘';
  }

  if (!direction && vertical === 'up') {
    direction = '↑';
  }

  if (!direction && vertical === 'down') {
    direction = '↓';
  }

  if (!direction && horizontal === 'left') {
    direction = '←';
  }

  if (!direction && horizontal === 'right') {
    direction = '→';
  }

  if (direction) {
    if (nameText) {
      nameText = `${direction} ${nameText}`;
    } else {
      nameText = direction;
    }
  }

  context.font = '600 12px system-ui';
  let nameWidth = 0;
  if (nameText) {
    nameWidth = context.measureText(nameText).width;
  }

  context.font = '500 10px system-ui';
  const sizeWidth = context.measureText(sizeText).width;
  let labelWidth = sizeWidth + 10;
  if (nameText) {
    labelWidth += nameWidth + 8;
  }
  const labelHeight = 18;
  const edgePadding = 2;

  let labelLeft = currentRect.x;
  let labelTop = currentRect.y - 18;

  if (labelTop < edgePadding) {
    labelTop = currentRect.y + 2;
  }

  if (labelLeft < edgePadding) {
    labelLeft = edgePadding;
  }

  const maxLabelLeft = width - labelWidth - edgePadding;
  if (labelLeft > maxLabelLeft) {
    labelLeft = maxLabelLeft;
  }

  if (labelLeft < edgePadding) {
    labelLeft = edgePadding;
  }

  const maxLabelTop = height - labelHeight - edgePadding;
  if (labelTop > maxLabelTop) {
    labelTop = maxLabelTop;
  }

  if (labelTop < edgePadding) {
    labelTop = edgePadding;
  }

  context.fillStyle = labelFillStyle;
  context.fillRect(labelLeft, labelTop, labelWidth, labelHeight);
  let textX = labelLeft + 5;
  if (nameText) {
    context.font = '600 12px system-ui';
    context.fillStyle = '#0b1220';
    context.fillText(nameText, textX, labelTop + 12);
    textX += nameWidth + 8;
  }
  context.font = '500 10px system-ui';
  context.fillStyle = 'rgba(11, 18, 32, 0.72)';
  context.fillText(sizeText, textX, labelTop + 12);

  const dx = Math.abs(targetRect.x - currentRect.x);
  const dy = Math.abs(targetRect.y - currentRect.y);
  const dw = Math.abs(targetRect.width - currentRect.width);
  const dh = Math.abs(targetRect.height - currentRect.height);

  if (dx <= 0.5 && dy <= 0.5 && dw <= 0.5 && dh <= 0.5) {
    currentRect = {
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
    };
    stopLoop();
  }
}

function startLoop() {
  if (timer) return;
  timer = setInterval(drawFrame, 16);
}

function stopLoop() {
  if (!timer) return;
  clearInterval(timer);
  timer = 0;
}

self.addEventListener('message', (event) => {
  const message = event.data as WorkerMessage;

  if (message.type === 'init') {
    canvas = message.canvas;
    context = canvas.getContext('2d');
    width = message.width;
    height = message.height;
    dpr = message.dpr;
    syncCanvasSize();
    drawFrame();
    return;
  }

  if (message.type === 'resize') {
    width = message.width;
    height = message.height;
    dpr = message.dpr;
    syncCanvasSize();
    drawFrame();
    return;
  }

  if (message.type === 'target') {
    targetRect = message.rect;
    label = message.label;
    color = message.color;
    startLoop();
    return;
  }

  if (message.type === 'cursor') {
    cursorPosition = message.position;
    cursorColor = message.color;
    if (cursorPosition) {
      startLoop();
    }
    drawFrame();
    return;
  }

  if (message.type === 'dispose') {
    stopLoop();
    self.close();
  }
});

export default {};

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
  selectedRect: Rect | null;
  label: string;
  selectedLabel: string;
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
let selectedTargetRect: Rect | null = null;
let selectedCurrentRect: Rect | null = null;
let label = '';
let selectedLabel = '';
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
  }

  if (!selectedTargetRect) {
    selectedCurrentRect = null;
  }

  if (!targetRect && !selectedTargetRect) {
    // Keep loop running if cursor position exists (picker active)
    if (!cursorPosition) {
      stopLoop();
    }
    return;
  }

  if (targetRect && !currentRect) {
    currentRect = {
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
    };
  } else if (targetRect && currentRect) {
    currentRect = {
      x: currentRect.x + (targetRect.x - currentRect.x) * 0.3,
      y: currentRect.y + (targetRect.y - currentRect.y) * 0.3,
      width: currentRect.width + (targetRect.width - currentRect.width) * 0.3,
      height:
        currentRect.height + (targetRect.height - currentRect.height) * 0.3,
    };
  }

  if (selectedTargetRect && !selectedCurrentRect) {
    selectedCurrentRect = {
      x: selectedTargetRect.x,
      y: selectedTargetRect.y,
      width: selectedTargetRect.width,
      height: selectedTargetRect.height,
    };
  } else if (selectedTargetRect && selectedCurrentRect) {
    selectedCurrentRect = {
      x:
        selectedCurrentRect.x +
        (selectedTargetRect.x - selectedCurrentRect.x) * 0.3,
      y:
        selectedCurrentRect.y +
        (selectedTargetRect.y - selectedCurrentRect.y) * 0.3,
      width:
        selectedCurrentRect.width +
        (selectedTargetRect.width - selectedCurrentRect.width) * 0.3,
      height:
        selectedCurrentRect.height +
        (selectedTargetRect.height - selectedCurrentRect.height) * 0.3,
    };
  }

  let selectionFillStyle = 'rgba(66, 153, 225, 0.4)';
  let selectionStrokeStyle = 'rgba(66, 153, 225, 0.8)';
  let selectionOuterStrokeStyle = 'rgba(30, 90, 160, 0.95)';
  let hoverFillStyle = 'rgba(66, 153, 225, 0.18)';
  let hoverStrokeStyle = 'rgba(66, 153, 225, 0.55)';
  let hoverOuterStrokeStyle = 'rgba(30, 90, 160, 0.72)';
  let selectionLabelFillStyle = 'rgba(66, 153, 225, 0.95)';
  let hoverLabelFillStyle = 'rgba(66, 153, 225, 0.8)';

  if (color === 'pink') {
    selectionFillStyle = 'rgba(236, 72, 153, 0.35)';
    selectionStrokeStyle = 'rgba(236, 72, 153, 0.85)';
    selectionOuterStrokeStyle = 'rgba(160, 40, 100, 0.95)';
    hoverFillStyle = 'rgba(236, 72, 153, 0.16)';
    hoverStrokeStyle = 'rgba(236, 72, 153, 0.55)';
    hoverOuterStrokeStyle = 'rgba(160, 40, 100, 0.72)';
    selectionLabelFillStyle = 'rgba(236, 72, 153, 0.95)';
    hoverLabelFillStyle = 'rgba(236, 72, 153, 0.8)';
  }

  if (color === 'green') {
    selectionFillStyle = 'rgba(34, 197, 94, 0.32)';
    selectionStrokeStyle = 'rgba(34, 197, 94, 0.82)';
    selectionOuterStrokeStyle = 'rgba(16, 120, 56, 0.95)';
    hoverFillStyle = 'rgba(34, 197, 94, 0.15)';
    hoverStrokeStyle = 'rgba(34, 197, 94, 0.52)';
    hoverOuterStrokeStyle = 'rgba(16, 120, 56, 0.72)';
    selectionLabelFillStyle = 'rgba(34, 197, 94, 0.95)';
    hoverLabelFillStyle = 'rgba(34, 197, 94, 0.8)';
  }

  if (color === 'red') {
    selectionFillStyle = 'rgba(239, 68, 68, 0.34)';
    selectionStrokeStyle = 'rgba(239, 68, 68, 0.85)';
    selectionOuterStrokeStyle = 'rgba(160, 30, 30, 0.95)';
    hoverFillStyle = 'rgba(239, 68, 68, 0.16)';
    hoverStrokeStyle = 'rgba(239, 68, 68, 0.55)';
    hoverOuterStrokeStyle = 'rgba(160, 30, 30, 0.72)';
    selectionLabelFillStyle = 'rgba(239, 68, 68, 0.95)';
    hoverLabelFillStyle = 'rgba(239, 68, 68, 0.8)';
  }

  if (color === 'amber') {
    selectionFillStyle = 'rgba(245, 158, 11, 0.34)';
    selectionStrokeStyle = 'rgba(245, 158, 11, 0.85)';
    selectionOuterStrokeStyle = 'rgba(160, 100, 5, 0.95)';
    hoverFillStyle = 'rgba(245, 158, 11, 0.16)';
    hoverStrokeStyle = 'rgba(245, 158, 11, 0.55)';
    hoverOuterStrokeStyle = 'rgba(160, 100, 5, 0.72)';
    selectionLabelFillStyle = 'rgba(245, 158, 11, 0.95)';
    hoverLabelFillStyle = 'rgba(245, 158, 11, 0.8)';
  }

  context.lineWidth = 1;

  if (selectedCurrentRect) {
    context.fillStyle = selectionFillStyle;
    context.fillRect(
      selectedCurrentRect.x,
      selectedCurrentRect.y,
      selectedCurrentRect.width,
      selectedCurrentRect.height
    );

    context.strokeStyle = selectionOuterStrokeStyle;
    context.strokeRect(
      selectedCurrentRect.x - 1,
      selectedCurrentRect.y - 1,
      selectedCurrentRect.width + 2,
      selectedCurrentRect.height + 2
    );

    context.strokeStyle = selectionStrokeStyle;
    context.strokeRect(
      selectedCurrentRect.x,
      selectedCurrentRect.y,
      selectedCurrentRect.width,
      selectedCurrentRect.height
    );

    const selectedBoxWidth = Math.round(Math.max(0, selectedCurrentRect.width));
    const selectedBoxHeight = Math.round(
      Math.max(0, selectedCurrentRect.height)
    );
    const selectedSizeText = `${selectedBoxWidth}x${selectedBoxHeight}`;
    let selectedNameText = selectedLabel;

    context.font = '600 12px system-ui';
    let selectedNameWidth = 0;
    if (selectedNameText) {
      selectedNameWidth = context.measureText(selectedNameText).width;
    }

    context.font = '500 10px system-ui';
    const selectedSizeWidth = context.measureText(selectedSizeText).width;
    let selectedLabelWidth = selectedSizeWidth + 10;
    if (selectedNameText) {
      selectedLabelWidth += selectedNameWidth + 8;
    }
    const selectedLabelHeight = 18;
    const edgePadding = 2;

    let selectedLabelLeft = selectedCurrentRect.x;
    let selectedLabelTop = selectedCurrentRect.y - 18;

    if (selectedLabelTop < edgePadding) {
      selectedLabelTop = selectedCurrentRect.y + 2;
    }

    if (selectedLabelLeft < edgePadding) {
      selectedLabelLeft = edgePadding;
    }

    const maxSelectedLabelLeft = width - selectedLabelWidth - edgePadding;
    if (selectedLabelLeft > maxSelectedLabelLeft) {
      selectedLabelLeft = maxSelectedLabelLeft;
    }

    if (selectedLabelLeft < edgePadding) {
      selectedLabelLeft = edgePadding;
    }

    const maxSelectedLabelTop = height - selectedLabelHeight - edgePadding;
    if (selectedLabelTop > maxSelectedLabelTop) {
      selectedLabelTop = maxSelectedLabelTop;
    }

    if (selectedLabelTop < edgePadding) {
      selectedLabelTop = edgePadding;
    }

    context.fillStyle = selectionLabelFillStyle;
    context.fillRect(
      selectedLabelLeft,
      selectedLabelTop,
      selectedLabelWidth,
      selectedLabelHeight
    );
    let selectedTextX = selectedLabelLeft + 5;
    if (selectedNameText) {
      context.font = '600 12px system-ui';
      context.fillStyle = '#0b1220';
      context.fillText(selectedNameText, selectedTextX, selectedLabelTop + 12);
      selectedTextX += selectedNameWidth + 8;
    }
    context.font = '500 10px system-ui';
    context.fillStyle = 'rgba(11, 18, 32, 0.72)';
    context.fillText(selectedSizeText, selectedTextX, selectedLabelTop + 12);
  }

  if (!currentRect || !targetRect) {
    let selectionSettled = !selectedTargetRect;
    if (selectedTargetRect && selectedCurrentRect) {
      const dx = Math.abs(selectedTargetRect.x - selectedCurrentRect.x);
      const dy = Math.abs(selectedTargetRect.y - selectedCurrentRect.y);
      const dw = Math.abs(selectedTargetRect.width - selectedCurrentRect.width);
      const dh = Math.abs(
        selectedTargetRect.height - selectedCurrentRect.height
      );
      selectionSettled = dx <= 0.5 && dy <= 0.5 && dw <= 0.5 && dh <= 0.5;
      if (selectionSettled) {
        selectedCurrentRect = {
          x: selectedTargetRect.x,
          y: selectedTargetRect.y,
          width: selectedTargetRect.width,
          height: selectedTargetRect.height,
        };
      }
    }

    if (selectionSettled) {
      stopLoop();
    }
    return;
  }

  context.fillStyle = hoverFillStyle;
  context.fillRect(
    currentRect.x,
    currentRect.y,
    currentRect.width,
    currentRect.height
  );

  context.strokeStyle = hoverOuterStrokeStyle;
  context.strokeRect(
    currentRect.x - 1,
    currentRect.y - 1,
    currentRect.width + 2,
    currentRect.height + 2
  );

  context.strokeStyle = hoverStrokeStyle;
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

  context.fillStyle = hoverLabelFillStyle;
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

  let hoverSettled = dx <= 0.5 && dy <= 0.5 && dw <= 0.5 && dh <= 0.5;
  if (hoverSettled) {
    currentRect = {
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
    };
  }

  let selectionSettled = !selectedTargetRect;
  if (selectedTargetRect && selectedCurrentRect) {
    const selectedDx = Math.abs(selectedTargetRect.x - selectedCurrentRect.x);
    const selectedDy = Math.abs(selectedTargetRect.y - selectedCurrentRect.y);
    const selectedDw = Math.abs(
      selectedTargetRect.width - selectedCurrentRect.width
    );
    const selectedDh = Math.abs(
      selectedTargetRect.height - selectedCurrentRect.height
    );
    selectionSettled =
      selectedDx <= 0.5 &&
      selectedDy <= 0.5 &&
      selectedDw <= 0.5 &&
      selectedDh <= 0.5;
    if (selectionSettled) {
      selectedCurrentRect = {
        x: selectedTargetRect.x,
        y: selectedTargetRect.y,
        width: selectedTargetRect.width,
        height: selectedTargetRect.height,
      };
    }
  }

  if (hoverSettled && selectionSettled) {
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
    selectedTargetRect = message.selectedRect;
    label = message.label;
    selectedLabel = message.selectedLabel;
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

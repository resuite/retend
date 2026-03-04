let canvas = null;
let context = null;
let width = 0;
let height = 0;
let dpr = 1;
let targetRect = null;
let currentRect = null;
let label = '';
let timer = 0;

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

  if (!targetRect) {
    currentRect = null;
    stopLoop();
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

  context.fillStyle = 'rgba(66, 153, 225, 0.4)';
  context.strokeStyle = 'rgba(66, 153, 225, 0.8)';
  context.lineWidth = 1;
  context.fillRect(
    currentRect.x,
    currentRect.y,
    currentRect.width,
    currentRect.height
  );
  context.strokeRect(
    currentRect.x,
    currentRect.y,
    currentRect.width,
    currentRect.height
  );

  context.font = '11px system-ui';
  const text = label;
  const textWidth = context.measureText(text).width;
  const labelWidth = textWidth + 10;
  let labelTop = currentRect.y - 18;
  if (labelTop < 2) {
    labelTop = currentRect.y + 2;
  }
  context.fillStyle = 'rgba(66, 153, 225, 0.95)';
  context.fillRect(currentRect.x, labelTop, labelWidth, 16);
  context.fillStyle = '#0b1220';
  context.fillText(text, currentRect.x + 5, labelTop + 11);

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

self.onmessage = (event) => {
  const message = event.data;

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
    startLoop();
    return;
  }

  if (message.type === 'dispose') {
    stopLoop();
    self.close();
  }
};

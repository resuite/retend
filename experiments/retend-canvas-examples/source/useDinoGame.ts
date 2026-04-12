import { Cell } from 'retend';

import { useWindowSize } from './useWindowSize';

export function useDinoGame() {
  const { width, height } = useWindowSize();

  const dinoY = Cell.source(0);
  const dinoVelocity = Cell.source(0);
  const score = Cell.source(0);
  const isGameOver = Cell.source(false);
  const obstacles = Cell.source<
    { x: number; type: 'small' | 'large'; id: number }[]
  >([]);

  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const GROUND_Y_OFFSET = 120;
  const OBSTACLE_SPEED = 10;
  const SPAWN_INTERVAL = 1500;

  let lastTime = 0;
  let spawnTimer = 0;
  let obstacleIdCounter = 0;

  const update = (time: number) => {
    if (isGameOver.peek()) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    // Update Dino
    const currentY = dinoY.peek();
    const currentVel = dinoVelocity.peek();

    if (currentY < 0 || currentVel < 0) {
      const nextVel = currentVel + GRAVITY;
      dinoVelocity.set(nextVel);
      const nextY = currentY + nextVel;
      if (nextY > 0) {
        dinoY.set(0);
        dinoVelocity.set(0);
      } else {
        dinoY.set(nextY);
      }
    } else {
      dinoY.set(0);
      dinoVelocity.set(0);
    }

    // Update Obstacles
    const currentObstacles = obstacles.peek();
    const nextObstacles = currentObstacles
      .map((o) => {
        const nextO = Object.assign({}, o);
        nextO.x -= OBSTACLE_SPEED;
        return nextO;
      })
      .filter((o) => o.x > -100);

    // Spawn new obstacle
    spawnTimer += deltaTime;
    if (spawnTimer > SPAWN_INTERVAL) {
      nextObstacles.push({
        x: width.peek(),
        type: Math.random() > 0.5 ? 'large' : 'small',
        id: obstacleIdCounter++,
      });
      spawnTimer = Math.min(SPAWN_INTERVAL, spawnTimer - SPAWN_INTERVAL);
    }

    obstacles.set(nextObstacles);

    // Collision Detection
    const h = height.peek();
    const dinoRect = {
      x: 100,
      y: h - GROUND_Y_OFFSET + dinoY.get() - 40,
      w: 40,
      h: 40,
    };
    for (const o of nextObstacles) {
      const obstacleW = o.type === 'large' ? 30 : 20;
      const obstacleH = o.type === 'large' ? 50 : 30;
      const obstacleRect = {
        x: o.x,
        y: h - GROUND_Y_OFFSET - obstacleH,
        w: obstacleW,
        h: obstacleH,
      };

      if (
        dinoRect.x < obstacleRect.x + obstacleRect.w &&
        dinoRect.x + dinoRect.w > obstacleRect.x &&
        dinoRect.y < obstacleRect.y + obstacleRect.h &&
        dinoRect.y + dinoRect.h > obstacleRect.y
      ) {
        isGameOver.set(true);
      }
    }

    // Update Score
    score.set(score.peek() + 1);

    requestAnimationFrame(update);
  };

  const handleJump = () => {
    if (isGameOver.peek()) {
      isGameOver.set(false);
      dinoY.set(0);
      dinoVelocity.set(0);
      obstacles.set([]);
      score.set(0);
      lastTime = performance.now();
      requestAnimationFrame(update);
      return;
    }
    if (dinoY.peek() === 0) {
      dinoVelocity.set(JUMP_FORCE);
    }
  };

  requestAnimationFrame((time) => {
    lastTime = time;
    update(time);
  });

  return {
    width,
    height,
    dinoY,
    score,
    isGameOver,
    obstacles,
    GROUND_Y_OFFSET,
    handleJump,
  };
}

export function applyTimingFunction(
  progress: number,
  [x1, y1, x2, y2]: [number, number, number, number]
): number {
  if (progress <= 0 || progress >= 1) return Math.max(0, Math.min(1, progress));

  let start = 0;
  let end = 1;
  let time = progress;

  for (let index = 0; index < 12; index += 1) {
    time = (start + end) / 2;
    const inverse = 1 - time;
    const sample =
      3 * inverse * inverse * time * x1 +
      3 * inverse * time * time * x2 +
      time * time * time;

    if (sample < progress) start = time;
    else end = time;
  }

  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * y1 +
    3 * inverse * time * time * y2 +
    time * time * time
  );
}

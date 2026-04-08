import { Easing, type EasingValue } from '../style';

export function applyEasing(timingFunction: EasingValue, progress: number) {
  if (Array.isArray(timingFunction)) {
    const [x1, y1, x2, y2] = timingFunction;
    let start = 0;
    let end = 1;
    let t = progress;
    for (let i = 0; i < 8; i += 1) {
      t = (start + end) / 2;
      const inverse = 1 - t;
      const x =
        3 * inverse * inverse * t * x1 + 3 * inverse * t * t * x2 + t * t * t;
      if (x < progress) {
        start = t;
      } else {
        end = t;
      }
    }
    const inverse = 1 - t;
    return (
      3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t
    );
  }
  if (timingFunction === Easing.Linear) return progress;
  if (timingFunction === Easing.EaseIn) {
    return progress * progress * progress;
  }
  if (timingFunction === Easing.EaseOut) {
    const inverse = 1 - progress;
    return 1 - inverse * inverse * inverse;
  }
  if (timingFunction === Easing.EaseInOut) {
    if (progress < 0.5) return 4 * progress * progress * progress;
    const inverse = 1 - progress;
    return 1 - 4 * inverse * inverse * inverse;
  }
  const cosine = Math.cos(Math.PI * progress);
  return -((cosine - 1) / 2);
}

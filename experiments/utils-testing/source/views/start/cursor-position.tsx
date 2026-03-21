import { useCursorPosition } from 'retend-utils/hooks';

export default function CursorPosition() {
  const { x, y } = useCursorPosition();

  return (
    <div>
      <h1>useCursorPosition</h1>
      <p>Move your mouse around the window.</p>
      <p>
        Cursor Position: X: {x}, Y: {y}
      </p>
    </div>
  );
}

import { useWindowSize } from 'retend-utils/hooks';

export default function WindowSizeTest() {
  const { width, height } = useWindowSize();

  return (
    <div
      style={{
        height: '300px',
        width: '300px',
        border: '1px solid black',
        padding: '20px',
      }}
    >
      <h1>Window Size Test</h1>
      <p>
        This component uses the useWindowSize hook to track the window size.
      </p>
      <p>Window width: {width}px</p>
      <p>Window height: {height}px</p>
    </div>
  );
}

import { Cell } from 'retend';
import { useElementBounding } from 'retend-utils/hooks';

export default function ElementBoundingTest() {
  const ref = Cell.source<HTMLDivElement | null>(null);
  const boundingRect = useElementBounding(ref);

  return (
    <div
      ref={ref}
      style={{
        height: '300px',
        width: '300px',
        border: '1px solid black',
        resize: 'both',
        overflow: 'auto',
        padding: '20px',
      }}
    >
      <h1>Element Bounding Test</h1>
      <p>
        This component uses the useElementBounding hook to track the bounding
        rectangle of an element. Resize the element to see the bounding
        rectangle update in real-time.
      </p>
      top: {boundingRect.top}
      <br />
      right: {boundingRect.right}
      <br />
      bottom: {boundingRect.bottom}
      <br />
      left: {boundingRect.left}
      <br />
      height: {boundingRect.height}
      <br />
      width: {boundingRect.width}
    </div>
  );
}

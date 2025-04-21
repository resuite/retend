import { Cell } from 'retend';
import { useLiveDate } from 'retend-utils/hooks';

export default function LiveDateTest() {
  const date = useLiveDate();
  const localeTimeString = Cell.derived(() => date.value.toLocaleTimeString());

  return (
    <div
      style={{
        height: '300px',
        width: '300px',
        border: '1px solid black',
        padding: '20px',
      }}
    >
      <h1>Live Date Test</h1>
      <p>
        This component uses the useLiveDate hook to display the current date and
        time.
      </p>
      <p>Current date and time: {localeTimeString}</p>
    </div>
  );
}

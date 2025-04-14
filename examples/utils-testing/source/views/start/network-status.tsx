import { useOnlineStatus } from 'retend-utils/hooks';
import { If } from 'retend';

export default function NetworkStatusView() {
  const isOnline = useOnlineStatus();

  return (
    <div
      style={{
        height: '300px',
        width: '300px',
        border: '1px solid black',
        padding: '20px',
      }}
    >
      <h1>useNetworkStatus Example</h1>
      <p>
        Current network status:{' '}
        <strong>
          {If(isOnline, {
            true: () => 'Online',
            false: () => 'Offline',
          })}
        </strong>
      </p>
      <p>
        Try toggling your network connection on/off in your system settings or
        browser developer tools to see the status update.
      </p>
    </div>
  );
}

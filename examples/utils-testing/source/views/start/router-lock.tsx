import { Cell, If } from 'retend';
import { useRouter } from 'retend/router';

export default function RouterLockView() {
  const navigationPrevented = Cell.source(false);
  const router = useRouter();
  const isLocked = Cell.source(false);

  const lockRouter = () => {
    router.lock();
    isLocked.value = true;
  };

  const unlockRouter = () => {
    router.unlock();
    isLocked.value = false;
  };

  const navigateToHome = () => {
    router.navigate('/');
  };

  router.addEventListener('routelockprevented', () => {
    navigationPrevented.value = true;
  });

  return (
    <div>
      <h1>Router Lock Test</h1>
      <p>This is a test page for router locking.</p>
      {If(isLocked, {
        false: () => (
          <button type="button" onClick={lockRouter}>
            Lock Router
          </button>
        ),
        true: () => (
          <button type="button" onClick={unlockRouter}>
            Unlock Router
          </button>
        ),
      })}
      <button type="button" onClick={navigateToHome}>
        Navigate to Home
      </button>
      {If(navigationPrevented, () => (
        <p>Navigation Prevented!</p>
      ))}
    </div>
  );
}

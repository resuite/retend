import { Count } from './scopes.ts';
import styles from './count-update.module.css';
import { useScopeContext } from 'retend';
import { TeleportedElement } from './teleported.tsx';

export function CountUpdate() {
  const count = useScopeContext(Count);

  const increment = () => {
    count.set(count.get() + 1);
  };

  const decrement = () => {
    count.set(count.get() - 1);
  };

  return (
    <div>
      <button class={styles.button} type="button" onClick={increment}>
        Increment
      </button>
      <button class={styles.button} type="button" onClick={decrement}>
        Decrement
      </button>
      <TeleportedElement />
    </div>
  );
}

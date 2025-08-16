import { useScopeContext } from 'retend';
import { Count } from './scopes';
import styles from './nested-route.module.css';

export function NestedRoute() {
  const count = useScopeContext(Count);
  return <div class={styles.box}>Spin! {count}</div>;
}

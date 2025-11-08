import { useScopeContext } from 'retend';
import { Count } from './scopes';
import styles from './nested-route.module.css';
import { UserDataProvider } from '@/views/scope-provider';
import { ScopeContextUser } from '@/views/scope-provider-user';

export function NestedRoute() {
  const count = useScopeContext(Count);
  return (
    <>
      <UserDataProvider>{() => <ScopeContextUser />}</UserDataProvider>
      <div class={styles.box}>Spin! {count}</div>
    </>
  );
}

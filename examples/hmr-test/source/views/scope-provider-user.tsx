import { useUserData } from '@/views/scope-provider';

export function ScopeContextUser() {
  const { increment } = useUserData();

  return (
    <div>
      <button type="button" onClick={increment}>
        Increment
      </button>
    </div>
  );
}

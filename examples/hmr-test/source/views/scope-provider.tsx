import { Cell, createScope, useScopeContext } from 'retend';
import type { JSX } from 'retend/jsx-runtime';

interface UserData {
  name: string;
  increment: () => void;
  decrement: () => void;
}

export const COUNT = 3;
const UserDataScope = createScope<UserData>();

export function useUserData() {
  return useScopeContext(UserDataScope);
}

export function UserDataProvider({
  children,
}: {
  children: () => JSX.Template;
}) {
  const count = Cell.source(0);
  const count1 = Cell.source(0);

  const userData = {
    name: 'John Doe',
    increment: () => count.set(count.get() + 1),
    decrement: () => count.set(count.get() - 1),
  };

  const userData2 = {
    name: 'John Doe',
    increment: () => count1.set(count1.get() + 1),
    decrement: () => count1.set(count1.get() - 1),
  };

  return (
    <>
      <UserDataScope.Provider value={userData}>
        {() => (
          <>
            the count: {count}
            {children()}
          </>
        )}
      </UserDataScope.Provider>
      <UserDataScope.Provider value={userData2}>
        {() => (
          <>
            the count (2): {count1}
            {children()}
          </>
        )}
      </UserDataScope.Provider>
    </>
  );
}

import { Cell } from 'retend';
import { createScope, useScopeContext } from 'retend';
import { For, If } from 'retend';

// --- Scopes Definition ---
const ThemeScope = createScope<Cell<string>>();
const UserScope = createScope<Cell<{ name: string; roles: string[] }>>();

// --- Components ---

const UserRoles = () => {
  const user = useScopeContext(UserScope);

  return (
    <ul>
      {For(user.get().roles, (role) => (
        <li>{role}</li>
      ))}
    </ul>
  );
};

const UserProfile = () => {
  const theme = useScopeContext(ThemeScope);
  const user = useScopeContext(UserScope);
  const isAdmin = Cell.derived(() => user.get().roles.includes('admin'));

  const style = Cell.derived(() => ({
    padding: '10px',
    border: `1px solid ${theme.get() === 'dark' ? 'white' : 'black'}`,
    backgroundColor: theme.get() === 'dark' ? '#333' : '#EEE',
    color: theme.get() === 'dark' ? 'white' : 'black',
  }));

  return (
    <div style={style}>
      <h2>User Profile</h2>
      <p>Name: {Cell.derived(() => user.get().name)}</p>
      {If(isAdmin, {
        true: () => <p>Welcome, Admin!</p>,
        false: () => <p>Welcome, User!</p>,
      })}
      <UserRoles />
    </div>
  );
};

export default function ScopeTest() {
  const theme = Cell.source('light');
  const user = Cell.source({
    name: 'John Doe',
    roles: ['editor', 'viewer'],
  });

  const toggleTheme = () => {
    theme.set(theme.get() === 'light' ? 'dark' : 'light');
  };

  const grantAdmin = () => {
    user.set({ ...user.get(), roles: [...user.get().roles, 'admin'] });
  };

  return (
    <div>
      <h1>Complex Scope Test</h1>
      <ThemeScope.Provider value={theme}>
        {() => (
          <UserScope.Provider value={user}>
            {() => <UserProfile />}
          </UserScope.Provider>
        )}
      </ThemeScope.Provider>
      <button type="button" onClick={toggleTheme}>
        Toggle Theme
      </button>
      <button type="button" onClick={grantAdmin}>
        Grant Admin
      </button>
    </div>
  );
}

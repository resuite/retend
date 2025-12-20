import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  combineScopes,
  createScope,
  useScopeContext,
  getActiveRenderer,
} from 'retend';
import { resetGlobalContext } from 'retend/context';
import { createWebRouter, useRouter } from 'retend/router';
import { routerSetup, getTextContent, routerRoot } from '../setup.tsx';
import type { DOMRenderer } from 'retend-web';

describe('Scopes in Routing', () => {
  beforeEach(() => {
    routerSetup();
  });

  afterAll(() => {
    resetGlobalContext();
  });

  it('should support a provider and caller in the same routing context', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    interface Data {
      name: string;
    }

    const DataScope = createScope<Data>();

    const Content = () => {
      const scope = useScopeContext(DataScope);
      return <div>Username is {scope.name}</div>;
    };

    const Home = () => {
      const { Outlet } = useRouter();
      const data: Data = { name: 'Sefunmi' };
      return <DataScope.Provider value={data} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'Home',
          path: '/',
          component: Home,
          children: [
            {
              name: 'Content',
              path: 'content',
              component: Content,
            },
          ],
        },
      ],
    });

    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/content');
    expect(getTextContent(window.document.body)).toBe('Username is Sefunmi');
  });

  it('should support multiple providers in the same routing context', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    interface UserData {
      id: string;
      name: string;
    }

    interface UserAdress {
      street: string;
      city: string;
      state: string;
      zip: string;
    }

    const UserScope = createScope<UserData>();
    const UserAddressScope = createScope<UserAdress>();

    const User = () => {
      const scope = useScopeContext(UserScope);
      const addressScope = useScopeContext(UserAddressScope);
      return (
        <div>
          <div>Username is {scope.name}</div>
          <div>Address is {addressScope.street}</div>
        </div>
      );
    };

    const App = () => {
      const { Outlet } = useRouter();
      const userData: UserData = { id: '1', name: 'Sefunmi' };
      const userAddress: UserAdress = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
      };

      const Scope = combineScopes(UserScope, UserAddressScope);
      const combinedData = {
        [UserScope.key]: userData,
        [UserAddressScope.key]: userAddress,
      };
      return <Scope.Provider value={combinedData} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'App',
          path: '/',
          component: App,
          children: [
            {
              name: 'User',
              path: '/user',
              component: User,
            },
          ],
        },
      ],
    });

    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/user');
    expect(getTextContent(window.document.body)).toContain(
      'Username is Sefunmi'
    );
    expect(getTextContent(window.document.body)).toContain(
      'Address is 123 Main St'
    );
  });

  it('should allow a grandchild route to consume a scope provided by a parent route across different outlets', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    interface ProfileData {
      username: string;
    }

    const ProfileScope = createScope<ProfileData>();

    const Grandchild = () => {
      const profile = useScopeContext(ProfileScope);
      return <div>Grandchild sees username: {profile.username}</div>;
    };

    const Child = () => {
      const { Outlet } = useRouter();
      return (
        <div>
          <div>Child Route</div>
          <Outlet />
        </div>
      );
    };

    const Parent = () => {
      const { Outlet } = useRouter();
      const profile: ProfileData = { username: 'NestedUser' };
      return <ProfileScope.Provider value={profile} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'Parent',
          path: '/',
          component: Parent,
          children: [
            {
              name: 'Child',
              path: 'child',
              component: Child,
              children: [
                {
                  name: 'Grandchild',
                  path: 'grandchild',
                  component: Grandchild,
                },
              ],
            },
          ],
        },
      ],
    });

    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/child/grandchild');
    expect(getTextContent(window.document.body)).toContain(
      'Grandchild sees username: NestedUser'
    );
  });

  it('should not leak scope between sibling routes when only one provides it', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    interface SessionData {
      token: string;
    }

    const SessionScope = createScope<SessionData>();

    const Protected = () => {
      const session = useScopeContext(SessionScope);
      return <div>Token: {session.token}</div>;
    };

    // This route does NOT provide the scope
    const Public = () => {
      let error = '';
      try {
        useScopeContext(SessionScope);
      } catch {
        error = 'No session';
      }
      return <div>{error || 'Session found'}</div>;
    };

    const App = () => {
      const { Outlet } = useRouter();
      return <Outlet />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'App',
          path: '/',
          component: App,
          children: [
            {
              name: 'Protected',
              path: 'protected',
              component: () => (
                <SessionScope.Provider
                  value={{ token: 'abc123' }}
                  content={Protected}
                />
              ),
            },
            {
              name: 'Public',
              path: 'public',
              component: Public,
            },
          ],
        },
      ],
    });

    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/protected');
    expect(getTextContent(window.document.body)).toBe('Token: abc123');

    await router.navigate('/public');
    expect(getTextContent(window.document.body)).toBe('No session');

    await router.navigate('/protected');
    expect(getTextContent(window.document.body)).toBe('Token: abc123');
  });

  it('should reset scope when navigating between routes with and without provider', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    interface Data {
      name: string;
    }

    const DataScope = createScope<Data>();

    const Content = () => {
      const scope = useScopeContext(DataScope);
      return <div>Username is {scope.name}</div>;
    };

    const NoScope = () => <div>No scope here</div>;

    const Home = () => {
      const { Outlet } = useRouter();
      const data: Data = { name: 'Sefunmi' };
      return <DataScope.Provider value={data} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'Home',
          path: '/',
          component: Home,
          children: [
            {
              name: 'Content',
              path: 'content',
              component: Content,
            },
            {
              name: 'NoScope',
              path: 'noscope',
              component: NoScope,
            },
          ],
        },
      ],
    });

    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/content');
    expect(getTextContent(window.document.body)).toBe('Username is Sefunmi');

    await router.navigate('/noscope');
    expect(getTextContent(window.document.body)).toBe('No scope here');

    await router.navigate('/content');
    expect(getTextContent(window.document.body)).toBe('Username is Sefunmi');
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { combineScopes, createScope, useScopeContext } from "retend";
import { getGlobalContext, resetGlobalContext } from "retend/context";
import { createWebRouter, useRouter } from "retend/router";
import { routerSetup, getTextContent } from "../setup.ts";

describe("Scopes in Routing", () => {
  beforeEach(() => {
    routerSetup();
  });

  afterAll(() => {
    resetGlobalContext();
  });

  it("should support a provider and caller in the same routing context", async () => {
    const { window } = getGlobalContext();
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
      const data: Data = { name: "Sefunmi" };
      return <DataScope.Provider value={data} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: "Home",
          path: "/",
          component: Home,
          children: [
            {
              name: "Content",
              path: "content",
              component: Content,
            },
          ],
        },
      ],
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/content");
    expect(getTextContent(window.document.body)).toBe("Username is Sefunmi");
  });

  it("should support multiple providers in the same routing context", async () => {
    const { window } = getGlobalContext();
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
      const userData: UserData = { id: "1", name: "Sefunmi" };
      const userAddress: UserAdress = {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "12345",
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
          name: "App",
          path: "/",
          component: App,
          children: [
            {
              name: "User",
              path: "/user",
              component: User,
            },
          ],
        },
      ],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/user");
    expect(getTextContent(window.document.body)).toContain(
      "Username is Sefunmi",
    );
    expect(getTextContent(window.document.body)).toContain(
      "Address is 123 Main St",
    );
  });

  it("should allow a grandchild route to consume a scope provided by a parent route across different outlets", async () => {
    const { window } = getGlobalContext();
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
      const profile: ProfileData = { username: "NestedUser" };
      return <ProfileScope.Provider value={profile} content={Outlet} />;
    };

    const router = createWebRouter({
      routes: [
        {
          name: "Parent",
          path: "/",
          component: Parent,
          children: [
            {
              name: "Child",
              path: "child",
              component: Child,
              children: [
                {
                  name: "Grandchild",
                  path: "grandchild",
                  component: Grandchild,
                },
              ],
            },
          ],
        },
      ],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/child/grandchild");
    expect(getTextContent(window.document.body)).toContain(
      "Grandchild sees username: NestedUser",
    );
  });
});

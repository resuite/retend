import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getGlobalContext, resetGlobalContext } from "retend/context";
import { getTextContent, routerSetup } from "../setup.ts";
import {
  createWebRouter,
  defineRoute,
  defineRoutes,
  lazy,
  useRouter,
} from "retend/router";

describe("Router Lazy Subtrees", () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it("should load a lazy subtree", async () => {
    const { window } = getGlobalContext();

    const subtree = defineRoute({
      name: "about-me",
      path: "/about",
      component: () => {
        return <div>This is some info about me</div>;
      },
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/home",
          name: "home",
          children: [{ path: "", name: "home-child", component: () => "Home" }],
        },
        {
          path: "/about",
          subtree: lazy(() => Promise.resolve({ default: subtree })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/home");
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBe("home-child");

    await router.navigate("/about");
    const route3 = router.getCurrentRoute();
    expect(route3.get().name).toBe("about-me");
  });

  it("should load a lazy subtree not at the root level", async () => {
    const { window } = getGlobalContext();

    const nestedSubtree = defineRoute({
      name: "lazy-nested-route",
      path: "/child",
      component: () => {
        return <div>This is a lazy nested route</div>;
      },
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/parent",
          name: "parent",
          children: [
            {
              path: "/child",
              subtree: lazy(() => Promise.resolve({ default: nestedSubtree })),
            },
            { path: "/other", name: "parent-other", component: () => "Other" },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/parent/other");
    const route1 = router.getCurrentRoute();
    expect(route1.get().name).toBe("parent-other");

    await router.navigate("/parent/child");
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBe("lazy-nested-route");
  });

  it("should throw errors if the path of the subtree is not the same as the importer", async () => {
    const { window } = getGlobalContext();

    const misconfiguredSubtree = defineRoute({
      name: "incorrect-lazy-subtree",
      path: "/this-is-the-wrong-path",
      component: () => <div>This should not load correctly</div>,
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/parent-for-lazy",
          subtree: lazy(() =>
            Promise.resolve({ default: misconfiguredSubtree }),
          ),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await expect(router.navigate("/parent-for-lazy")).rejects.toThrow(
      "Lazy subtrees must have the same path as their parents. Parent path: /parent-for-lazy, Subtree path: /this-is-the-wrong-path",
    );
  });

  it("should load a lazy subtree directly importing a lazy subtree", async () => {
    const { window } = getGlobalContext();

    const deepestLazyComponent = defineRoute({
      name: "deepest-lazy-component",
      path: "/lazy-chain",
      component: () => <div>This is the deepest lazy component loaded</div>,
    });

    const middleLazyImporter = defineRoute({
      name: "middle-lazy-importer",
      path: "/lazy-chain",
      subtree: lazy(() => Promise.resolve({ default: deepestLazyComponent })),
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/lazy-chain",
          subtree: lazy(() => Promise.resolve({ default: middleLazyImporter })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/lazy-chain");

    const currentRoute = router.getCurrentRoute();
    expect(currentRoute.get().name).toBe("deepest-lazy-component");
    expect(currentRoute.get().path).toBe("/lazy-chain");
  });

  it("should load nested lazy subtrees", async () => {
    const { window } = getGlobalContext();

    const financeReportsComponent = defineRoute({
      name: "finance-reports",
      path: "/reports",
      component: () => <div>Finance Reports</div>,
    });

    const financeModule = defineRoute({
      name: "finance-module",
      path: "/finance",
      children: [
        {
          path: "/reports",
          subtree: lazy(() =>
            Promise.resolve({ default: financeReportsComponent }),
          ),
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/finance",
          subtree: lazy(() => Promise.resolve({ default: financeModule })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/finance/reports");

    const currentRoute = router.getCurrentRoute();
    expect(currentRoute.get().name).toBe("finance-reports");
    expect(currentRoute.get().path).toBe("/finance/reports");
  });
});

describe("Router Lazy Subtrees with Advanced Matching", () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it("should handle parameters defined before the lazy subtree", async () => {
    const { window } = getGlobalContext();

    const UserProfile = () => {
      const router = useRouter();
      const userId = router.params.get("userId");
      return <div>User ID: {userId}</div>;
    };

    const profileSubtree = defineRoute({
      name: "user-profile-subtree",
      path: "/profile", // This path is relative to its mount point
      component: UserProfile,
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/users/:userId",
          children: [
            {
              path: "/profile",
              subtree: lazy(() => Promise.resolve({ default: profileSubtree })),
            },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/users/123/profile");
    expect(getTextContent(window.document.body)).toBe("User ID: 123");
  });

  it("should handle parameters defined within the lazy subtree", async () => {
    const { window } = getGlobalContext();

    const ProductPage = () => {
      const router = useRouter();
      const productId = router.params.get("productId");
      return <div>Product: {productId}</div>;
    };

    const productsSubtree = defineRoute({
      path: "/products",
      children: [
        {
          path: "/:productId",
          name: "product-detail",
          component: ProductPage,
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/products",
          subtree: lazy(() => Promise.resolve({ default: productsSubtree })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/products/xyz-789");
    expect(getTextContent(window.document.body)).toBe("Product: xyz-789");
  });

  it("should handle parameters defined both before and within the lazy subtree", async () => {
    const { window } = getGlobalContext();

    const StoreItem = () => {
      const router = useRouter();
      const storeId = router.params.get("storeId");
      const itemId = router.params.get("itemId");
      return (
        <div>
          Store: {storeId}, Item: {itemId}
        </div>
      );
    };

    const inventorySubtree = defineRoute({
      path: "/inventory",
      children: [
        {
          path: "/:itemId",
          name: "store-item",
          component: StoreItem,
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/stores/:storeId",
          children: [
            {
              path: "/inventory",
              subtree: lazy(() =>
                Promise.resolve({ default: inventorySubtree }),
              ),
            },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/stores/main-street/inventory/item-456");
    expect(getTextContent(window.document.body)).toBe(
      "Store: main-street, Item: item-456",
    );
  });

  it("should handle wildcards within a lazy subtree", async () => {
    const { window } = getGlobalContext();

    const DocsPage = () => {
      const router = useRouter();
      const pagePath = router.params.get("page");
      return <div>Docs Page: {pagePath}</div>;
    };

    const docsSubtree = defineRoute({
      path: "/docs",
      children: [
        {
          path: ":page*",
          name: "docs-catchall",
          component: DocsPage,
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/docs",
          subtree: lazy(() => Promise.resolve({ default: docsSubtree })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/docs/guides/advanced/routing");
    expect(getTextContent(window.document.body)).toBe(
      "Docs Page: guides/advanced/routing",
    );
  });

  it("should handle fallthrough (index) routes within a lazy subtree", async () => {
    const { window } = getGlobalContext();

    const DashboardHome = () => <div>Dashboard Home</div>;
    const DashboardSettings = () => <div>Dashboard Settings</div>;

    const dashboardSubtree = defineRoute({
      path: "/dashboard",
      children: [
        {
          path: "",
          name: "dashboard-home",
          component: DashboardHome,
        },
        {
          path: "/settings",
          name: "dashboard-settings",
          component: DashboardSettings,
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/dashboard",
          subtree: lazy(() => Promise.resolve({ default: dashboardSubtree })),
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate("/dashboard");
    expect(getTextContent(window.document.body)).toBe("Dashboard Home");

    await router.navigate("/dashboard/settings");
    expect(getTextContent(window.document.body)).toBe("Dashboard Settings");
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getGlobalContext, resetGlobalContext } from "retend/context";
import { routerSetup } from "../setup.ts";
import {
  createWebRouter,
  defineRoute,
  defineRoutes,
  lazy,
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
          subtree: lazy(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { default: subtree };
          }),
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
              subtree: lazy(async () => {
                await new Promise((r) => setTimeout(r, 50));
                return { default: nestedSubtree };
              }),
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
          subtree: lazy(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { default: misconfiguredSubtree };
          }),
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
      subtree: lazy(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { default: deepestLazyComponent };
      }),
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/lazy-chain",
          subtree: lazy(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { default: middleLazyImporter };
          }),
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
          subtree: lazy(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { default: financeReportsComponent };
          }),
        },
      ],
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: "/finance",
          subtree: lazy(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { default: financeModule };
          }),
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

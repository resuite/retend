import { describe, it, vi, expect, beforeEach, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { getTextContent, routerSetup, routerSetupBrowser } from '../setup.ts';
import { createWebRouter, defineRoutes, useRouter } from 'retend/router';
import { Cell, If, runPendingSetupEffects, useSetupEffect } from 'retend';

describe('Router Relay', () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it('should maintain element identity across route changes', async () => {
    const { window } = getGlobalContext();

    const SharedImage = () => {
      const { Relay } = useRouter();
      return (
        <Relay
          id="shared-image"
          source={() => <img src="test.jpg" alt="test" />}
        />
      );
    };

    const HomeRoute = () => (
      <div>
        <h1>Home</h1>
        <SharedImage />
      </div>
    );

    const DetailRoute = () => (
      <div>
        <h1>Detail</h1>
        <SharedImage />
      </div>
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', name: 'home page', component: HomeRoute },
        { path: '/detail', name: 'detail page', component: DetailRoute },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');
    const firstImg = window.document.querySelector('img');

    await router.navigate('/detail');
    const secondImg = window.document.querySelector('img');

    expect(firstImg).toBe(secondImg);
  });

  it('should handle multiple relays simultaneously', async () => {
    const { window } = getGlobalContext();

    const SharedElement = () => {
      const { Relay } = useRouter();
      return (
        <Relay
          id="shared-element"
          source={() => <div id="shared-element-1">shared element content</div>}
        />
      );
    };

    const SecondSharedElement = () => {
      const { Relay } = useRouter();
      return (
        <Relay
          id="shared-element-2"
          source={() => <div id="shared-element-2">shared element content</div>}
        />
      );
    };

    const PageOne = () => (
      <>
        This is page 1
        <SharedElement />
        <SecondSharedElement />
      </>
    );

    const PageTwo = () => (
      <>
        This is page two
        <SecondSharedElement />
        <SharedElement />
      </>
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/one', name: 'one', component: PageOne },
        { path: '/two', name: 'two', component: PageTwo },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/one');
    const firstEl1 = window.document.querySelector('#shared-element-1');
    const firstEl2 = window.document.querySelector('#shared-element-2');

    await router.navigate('/two');
    const secondEl1 = window.document.querySelector('#shared-element-1');
    const secondEl2 = window.document.querySelector('#shared-element-2');

    expect(firstEl1).toBe(secondEl1);
    expect(firstEl2).toBe(secondEl2);
  });
});

describe('Router Relay Effects', () => {
  routerSetupBrowser();

  it('should persist useSetupEffect across routes with matching relay id and cleanup when not', async () => {
    const { window } = getGlobalContext();

    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const RelayWithEffect = () => {
      const { Relay } = useRouter();

      return (
        <Relay
          id="effect-relay"
          source={() => {
            useSetupEffect(() => {
              setupFn();
              return () => cleanupFn();
            });
            return <div>Relay Content</div>;
          }}
        />
      );
    };

    const RouteWithRelay = () => (
      <div>
        <h1>With Relay: </h1>
        <RelayWithEffect />
      </div>
    );

    const RouteWithoutRelay = () => (
      <div>
        <h1>Without Relay</h1>
      </div>
    );

    const AnotherRouteWithRelay = () => (
      <div>
        <h1>Another With Relay: </h1>
        <RelayWithEffect />
      </div>
    );

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/',
          name: 'home page',
          component: () => <></>,
        },
        {
          path: '/with-relay',
          name: 'with relay',
          component: RouteWithRelay,
        },
        {
          path: '/without-relay',
          name: 'without relay',
          component: RouteWithoutRelay,
        },
        {
          path: '/another-with-relay',
          name: 'another with relay',
          component: AnotherRouteWithRelay,
        },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/with-relay');
    const { body } = window.document;
    expect(getTextContent(body)).toBe('With Relay: Relay Content');
    await runPendingSetupEffects();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    await router.navigate('/another-with-relay');
    expect(getTextContent(body)).toBe('Another With Relay: Relay Content');
    await runPendingSetupEffects();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    await router.navigate('/without-relay');
    expect(getTextContent(body)).toBe('Without Relay');

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should cleanup useSetupEffect in routing scenarios', async () => {
    const { window } = getGlobalContext();

    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const RelayWithEffect = () => {
      const { Relay } = useRouter();
      return (
        <Relay
          id="regular-relay"
          source={() => {
            useSetupEffect(() => {
              setupFn();
              return cleanupFn;
            });
            return <div>Relay Content</div>;
          }}
        />
      );
    };

    const RouteWithRelay = () => (
      <div>
        <h1>With Relay: </h1>
        <RelayWithEffect />
      </div>
    );

    const RouteWithoutRelay = () => (
      <div>
        <p>No relay</p>
      </div>
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', component: () => <></> },
        { path: '/with-relay', component: RouteWithRelay },
        { path: '/without-relay', component: RouteWithoutRelay },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();
    await runPendingSetupEffects();

    // Navigate to route with relay
    await router.navigate('/with-relay');
    const { body } = window.document;
    expect(getTextContent(body)).toBe('With Relay: Relay Content');
    await runPendingSetupEffects();
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    //   // Navigate away to route without relay
    await router.navigate('/without-relay');
    await runPendingSetupEffects();
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should cleanup useSetupEffect in regular scenarios without routing', async () => {
    const { window } = getGlobalContext();

    const setupFn = vi.fn();
    const cleanupFn = vi.fn();
    const shouldShowRelay = Cell.source(true);

    const RelayWithEffect = () => {
      const { Relay } = useRouter();
      return (
        <Relay
          id="regular-relay"
          source={() => {
            useSetupEffect(() => {
              setupFn();
              return cleanupFn;
            });
            return <div>Relay Content</div>;
          }}
        />
      );
    };

    const RouteWithRelay = () => (
      <div>
        <h1>With Relay: </h1>
        {If(shouldShowRelay, () => (
          <RelayWithEffect />
        ))}
      </div>
    );

    const AnotherRouteWithRelay = () => (
      <div>
        Another With Relay: <RelayWithEffect />
      </div>
    );

    const AnotherRouteWithConditionalRelay = () => (
      <div>
        Another With Relay:{' '}
        {If(shouldShowRelay, () => (
          <RelayWithEffect />
        ))}
      </div>
    );

    const RouteWithoutRelay = () => <div>No relay</div>;

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', component: () => <></> },
        { path: '/with-relay', component: RouteWithRelay },
        { path: '/another-with-relay', component: AnotherRouteWithRelay },
        {
          path: '/another-with-conditional-relay',
          component: AnotherRouteWithConditionalRelay,
        },
        { path: '/without-relay', component: RouteWithoutRelay },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();
    await runPendingSetupEffects();

    // Navigate to route with relay
    await router.navigate('/with-relay');
    const { body } = window.document;
    expect(getTextContent(body)).toBe('With Relay: Relay Content');
    await runPendingSetupEffects();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    shouldShowRelay.set(false);
    expect(getTextContent(body)).toBe('With Relay: ');

    expect(cleanupFn).toHaveBeenCalledTimes(1);

    shouldShowRelay.set(true);
    await runPendingSetupEffects();
    expect(getTextContent(body)).toBe('With Relay: Relay Content');

    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    await router.navigate('/another-with-relay');
    await runPendingSetupEffects();
    expect(getTextContent(body)).toBe('Another With Relay: Relay Content');

    expect(setupFn).toHaveBeenCalledTimes(2); // no call, because the relay is already loaded.
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    await router.navigate('/another-with-conditional-relay');
    await runPendingSetupEffects();
    expect(getTextContent(body)).toBe('Another With Relay: Relay Content');

    expect(setupFn).toHaveBeenCalledTimes(2); // no call, because the relay is already loaded.
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    shouldShowRelay.set(false);
    expect(getTextContent(body)).toBe('Another With Relay: ');

    expect(cleanupFn).toHaveBeenCalledTimes(2);

    shouldShowRelay.set(true);
    await runPendingSetupEffects();
    expect(getTextContent(body)).toBe('Another With Relay: Relay Content');

    expect(setupFn).toHaveBeenCalledTimes(3);
    expect(cleanupFn).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retent/context';
import { routerSetup } from '../setup.ts';
import { createWebRouter, defineRoutes, useRouter } from 'retent/router';

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

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { createWebRouter, defineRoutes } from 'retend/router';
import { routerSetup, getTextContent } from '../setup.tsx';

describe('beforenavigate event', () => {
  beforeEach(() => {
    routerSetup();
  });

  afterAll(() => {
    resetGlobalContext();
  });

  it('beforenavigate event is dispatched before navigation', async () => {
    const { window } = getGlobalContext();
    const listener = vi.fn();
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();

    router.addEventListener('beforenavigate', listener);

    await router.navigate('/');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.from).toBeUndefined();
    expect(listener.mock.calls[0][0].detail.to).toBe('/');

    await router.navigate('/about');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].detail.from).toBe('/');
    expect(listener.mock.calls[1][0].detail.to).toBe('/about');

    router.removeEventListener('beforenavigate', listener);
  });

  it('beforenavigate event can be prevented to cancel navigation', async () => {
    const { window } = getGlobalContext();
    const listener = vi.fn((event) => {
      if (event.detail.to === '/about') {
        event.preventDefault();
      }
    });
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();

    router.addEventListener('beforenavigate', listener);

    await router.navigate('/');
    expect(getTextContent(window.document.body)).toBe('Home');

    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toBe('Home'); // Navigation prevented

    router.removeEventListener('beforenavigate', listener);
  });

  it('beforenavigate event is dispatched in replace()', async () => {
    const { window } = getGlobalContext();
    const listener = vi.fn();
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();

    router.addEventListener('beforenavigate', listener);

    await router.navigate('/');
    expect(listener).toHaveBeenCalledTimes(1);

    router.replace('/about');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].detail.from).toBe('/');
    expect(listener.mock.calls[1][0].detail.to).toBe('/about');

    router.removeEventListener('beforenavigate', listener);
  });
});

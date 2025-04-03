import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import {
  createWebRouter,
  defineRoutes,
  useRouter,
  type RouteComponent,
  lazy,
} from 'retend/router';
import { Cell } from 'retend';
import { getTextContent, routerSetup } from '../setup.ts';

describe('Router Metadata', () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it('should contain correct metadata for current route', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'home',
        path: '/',
        component: () => 'Home Page',
        metadata: {
          title: 'Home Page',
          description: 'Welcome to the home page',
        },
      },
      {
        name: 'about',
        path: '/about',
        component: () => 'About Us',
        metadata: {
          title: 'About Us',
          description: 'Learn more about our company',
        },
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Home Page',
      description: 'Welcome to the home page',
    });

    await router.navigate('/about');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'About Us',
      description: 'Learn more about our company',
    });
  });

  it('should aggregate metadata from nested routes', async () => {
    const { window } = getGlobalContext();

    const routes = defineRoutes([
      {
        name: 'dashboard',
        path: 'dashboard',
        component: () => {
          const { Outlet } = useRouter();
          return (
            <>
              dashboard
              <Outlet />
            </>
          );
        },
        metadata: {
          section: 'Admin',
          requiresAuth: true,
        },
        children: [
          {
            name: 'users',
            path: 'users',
            component: () => <>This is the users route.</>,
            metadata: {
              title: 'User Management',
              permission: 'manage_users',
            },
          },
          {
            name: 'settings',
            path: 'settings',
            component: () => <>This is the settings route.</>,
            metadata: {
              title: 'System Settings',
              permission: 'manage_settings',
            },
          },
        ],
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/dashboard/users');
    expect(currentRoute.value.fullPath).toBe('/dashboard/users');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      section: 'Admin',
      requiresAuth: true,
      title: 'User Management',
      permission: 'manage_users',
    });

    await router.navigate('/dashboard/settings');
    expect(currentRoute.value.fullPath).toBe('/dashboard/settings');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      section: 'Admin',
      requiresAuth: true,
      title: 'System Settings',
      permission: 'manage_settings',
    });
  });

  it('should handle dynamic metadata based on route params', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'product-page',
        path: '/products/:id',
        component: () => 'Product Details',
        metadata: (data) => ({
          title: `Product ${data.params.get('id')}`,
          type: 'product-page',
        }),
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/123');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 123',
      type: 'product-page',
    });

    await router.navigate('/products/456');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 456',
      type: 'product-page',
    });
  });

  it('should handle async dynamic metadata', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'product-page',
        path: '/products/:id',
        component: () => 'Product Details',
        metadata: async (data) => {
          await new Promise((r) => setTimeout(r, 3));
          return {
            title: `Product ${data.params.get('id')}`,
            type: 'product-page',
          };
        },
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/123');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 123',
      type: 'product-page',
    });

    await router.navigate('/products/456');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 456',
      type: 'product-page',
    });
  });

  it('should update metadata when route params change', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'post-details',
        path: '/users/:userId/posts/:postId',
        component: () => 'Post Details',
        metadata: (data) => {
          const postId = data.params.get('postId');
          const userId = data.params.get('userId');
          return {
            title: `Post ${postId} by User ${userId}`,
            section: 'blog',
          };
        },
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/users/1/posts/100');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Post 100 by User 1',
      section: 'blog',
    });

    await router.navigate('/users/2/posts/200');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Post 200 by User 2',
      section: 'blog',
    });
  });

  it('should handle metadata with query parameters', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'post-details',
        path: '/search',
        component: () => 'Search Results',
        metadata: (data) => ({
          title: `Search Results for: ${data.query.get('q')}`,
          type: 'search-page',
        }),
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/search?q=javascript');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Search Results for: javascript',
      type: 'search-page',
    });
  });

  it('should read metadata from the component function object', async () => {
    const { window } = getGlobalContext();
    const Home: RouteComponent = () => {
      return <div>This is the home page</div>;
    };

    Home.metadata = {
      title: 'Home Page',
      description: 'Welcome to the home page',
    };

    const About: RouteComponent = () => {
      return <div>This is the about page</div>;
    };

    About.metadata = {
      title: 'About Page',
      description: 'Learn more about our company',
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'home page',
          path: '/home',
          component: Home,
        },
        {
          name: 'about page',
          path: '/about',
          component: lazy(() => Promise.resolve({ default: About })),
        },
      ],
    });
    const route = router.getCurrentRoute();
    const metadata = Cell.derived(() => route.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(window.location.pathname).toBe('/home');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Home Page',
      description: 'Welcome to the home page',
    });

    await router.navigate('/about');
    expect(window.location.pathname).toBe('/about');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'About Page',
      description: 'Learn more about our company',
    });
  });

  it('should inherit metadata from parent components', async () => {
    const { window } = getGlobalContext();

    const About: RouteComponent = () => {
      return <div>This is the about page</div>;
    };

    About.metadata = {
      title: 'About Page',
      description: 'Learn more about our company',
    };

    const Home: RouteComponent = () => {
      const { Outlet } = useRouter();
      return (
        <>
          <div>This is the home page</div>
          <Outlet />
        </>
      );
    };

    Home.metadata = {
      title: 'Home Page',
      description: 'Welcome to the home page',
    };

    const Tabs: RouteComponent = () => {
      return <div>This is the tabs page</div>;
    };
    Tabs.metadata = { tabPage: true };

    const Immersive: RouteComponent = () => {
      return <div>This is the immersive page</div>;
    };
    Immersive.metadata = {
      title: 'Immersive Page',
      immersivePage: true,
    };

    const router = createWebRouter({
      routes: [
        {
          name: 'home page',
          path: '/home',
          component: Home,
          children: [
            {
              name: 'tabs page',
              path: 'tabs',
              component: Tabs,
            },
            {
              name: 'immersive page',
              path: 'immersive',
              component: Immersive,
            },
          ],
        },
        {
          name: 'about page',
          path: '/about',
          component: About,
        },
      ],
    });
    const route = router.getCurrentRoute();
    const metadata = Cell.derived(() => route.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(window.location.pathname).toBe('/home');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Home Page',
      description: 'Welcome to the home page',
    });

    await router.navigate('/about');
    expect(window.location.pathname).toBe('/about');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'About Page',
      description: 'Learn more about our company',
    });

    await router.navigate('/home/tabs');
    expect(window.location.pathname).toBe('/home/tabs');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Home Page',
      description: 'Welcome to the home page',
      tabPage: true,
    });

    await router.navigate('/home/immersive');
    expect(window.location.pathname).toBe('/home/immersive');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Immersive Page',
      description: 'Welcome to the home page',
      immersivePage: true,
    });
  });

  it('should handle embedded metadata functions', async () => {
    const { window } = getGlobalContext();

    const ProductPage: RouteComponent = () => {
      return <div>This is the product page</div>;
    };

    ProductPage.metadata = (data) => ({
      title: `Product ${data.params.get('id')}`,
      type: 'product-page',
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          name: 'product-page',
          path: '/products/:id',
          component: ProductPage,
        },
      ]),
    });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/123');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 123',
      type: 'product-page',
    });
  });

  it('should handle embedded metadata functions with nested routes', async () => {
    const { window } = getGlobalContext();

    const ProductPage: RouteComponent = () => {
      const { Outlet } = useRouter();
      return (
        <div>
          This is the product page
          <Outlet />
        </div>
      );
    };

    ProductPage.metadata = (data) => ({
      title: `Product ${data.params.get('id')}`,
      type: 'product-page',
    });

    const ProductDetails: RouteComponent = () => {
      return <div>This is the product details page</div>;
    };

    ProductDetails.metadata = (data) => ({
      summary: `Summary: Product ${data.params.get('sku')}`,
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          name: 'product-page',
          path: '/products/:id',
          component: ProductPage,
          children: [
            {
              name: 'product-details',
              path: ':sku',
              component: ProductDetails,
            },
          ],
        },
      ]),
    });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/123/456');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 123',
      type: 'product-page',
      summary: 'Summary: Product 456',
    });
  });

  it('should handle async embedded metadata functions', async () => {
    const { window } = getGlobalContext();
    const BlogPage: RouteComponent = () => {
      return <div>Hello world!</div>;
    };

    BlogPage.metadata = async (data) => {
      await new Promise((r) => setTimeout(r, 3));
      return {
        id: Number(data.query.get('pageId')),
        title: 'Blog Title',
        content: 'This is blog content',
      };
    };

    const router = createWebRouter({
      routes: defineRoutes([
        { name: 'blog', path: '/blog', component: BlogPage },
      ]),
    });

    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/blog?pageId=123');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      id: 123,
      title: 'Blog Title',
      content: 'This is blog content',
    });
  });

  it('should read async metadata inside the route component', async () => {
    const { window } = getGlobalContext();

    const BlogPage: RouteComponent = () => {
      const router = useRouter();
      const currentRoute = router.getCurrentRoute();
      const metadata = currentRoute.value.metadata;
      const id = metadata.get('id');
      return <div>This is the blog for page {id}</div>;
    };

    BlogPage.metadata = async (data) => {
      await new Promise((r) => setTimeout(r, 3));
      return {
        id: Number(data.params.get('id')),
        title: 'Blog Title',
        content: 'This is blog content',
      };
    };

    const router = createWebRouter({
      routes: defineRoutes([
        { name: 'blog', path: '/blog/:id', component: BlogPage },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();
    const root = window.document.documentElement;

    await router.navigate('/blog/123');
    expect(getTextContent(root)).toBe('This is the blog for page 123');

    await router.navigate('/blog/1030');
    expect(getTextContent(root)).toBe('This is the blog for page 1030');

    await router.back();
    expect(getTextContent(root)).toBe('This is the blog for page 123');
  });

  it('should read embedded async metadata from a lazy route component', async () => {
    const { window } = getGlobalContext();

    const BlogPage: RouteComponent = () => {
      const router = useRouter();
      const currentRoute = router.getCurrentRoute();
      const metadata = currentRoute.value.metadata;
      const id = metadata.get('id');
      return <div>This is the blog for page {id}</div>;
    };

    BlogPage.metadata = async (data) => {
      await new Promise((r) => setTimeout(r, 3));
      return {
        id: Number(data.params.get('id')),
        title: 'Blog Title',
        content: 'This is blog content',
      };
    };

    const router = createWebRouter({
      routes: defineRoutes([
        {
          name: 'blog',
          path: '/blog/:id',
          component: lazy(() => Promise.resolve({ default: BlogPage })),
        },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();
    const root = window.document.documentElement;

    await router.navigate('/blog/123');
    expect(getTextContent(root)).toBe('This is the blog for page 123');

    await router.navigate('/blog/1030');
    expect(getTextContent(root)).toBe('This is the blog for page 1030');

    await router.back();
    expect(getTextContent(root)).toBe('This is the blog for page 123');
  });
});

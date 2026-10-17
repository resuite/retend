import { onSetup } from 'retend';
import { attachRouter, useWindow } from 'retend-gpui';
import { defineRoutes, Outlet, Router, RouterProvider } from 'retend/router';

import App from './app';
const routes = defineRoutes([{ path: '/', component: App, title: 'Example' }]);

export default function Root() {
  const window = useWindow();
  const router = new Router({ routes, linkTag: 'div' });

  onSetup(() => attachRouter(router, window));

  return (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  );
}

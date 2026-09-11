import { onSetup } from 'retend';
import { useWindow } from 'retend-gpui';
import { Outlet, Router, RouterProvider } from 'retend/router';

import App from './app';
const routes = [{ path: '/', component: App }];

export default function Root() {
  const window = useWindow();
  const router = new Router({ routes, linkTag: 'div' });

  onSetup(() => {
    const host = window.host as unknown as Window;
    const detach = router.attachWindowListeners(host);
    window.host.dispatchEvent(new Event('load'));
    return detach;
  });

  return (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  );
}

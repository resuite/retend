import { Outlet, Router, RouterProvider } from 'retend/router';

/** @param {Router} router */
export function createRouterRoot(router) {
  /** @type {*} */
  const rootOutlet = RouterProvider({ router, children: Outlet });
  return rootOutlet;
}

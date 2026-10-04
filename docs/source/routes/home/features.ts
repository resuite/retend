import type { Step } from './StepList';

interface FeatureDefinition extends Step<string> {
  filename: string;
  code: string;
  tags: readonly string[];
  href: string;
  linkLabel: string;
}

export const features = [
  {
    value: 'routing',
    label: 'Routing',
    title: 'Routing',
    body: 'Describe your pages as a tree of routes. Layouts wrap the pages inside them, a page can load the first time someone visits it, and middleware can redirect before anything renders.',
    filename: 'router.ts',
    tags: ['Nested routes', 'Lazy loading', 'Middleware', 'View transitions'],
    href: '/docs/defining-routes',
    linkLabel: 'Read about routing',
    code: `
import { Router, defineRoutes, lazy } from 'retend/router';

const routes = defineRoutes([
  { path: '/', component: Home },
  {
    path: '/dashboard',
    component: DashboardLayout,
    children: [
      { path: 'settings', component: lazy(() => import('./Settings')) },
    ],
  },
]);

export const router = new Router({ routes, middlewares: [auth] });
`,
  },
  {
    value: 'async',
    label: 'Async',
    title: 'Async',
    body: 'Load data with an async Cell, then wrap the part of the page that needs it in Await. Visitors see the fallback until the data arrives.',
    filename: 'Profile.tsx',
    tags: ['Async Cells', 'Await', 'Fallbacks'],
    href: '/docs/await',
    linkLabel: 'Read about Await',
    code: `
import { Await, Cell, If } from 'retend';

function Profile() {
  const user = Cell.derivedAsync(async () => {
    const response = await fetch('/api/user');
    return response.json();
  });

  return If(user, { true: (u) => <h2>{u.name}</h2> });
}

export const App = () => (
  <Await fallback={<p>Loading your profile…</p>}>
    <Profile />
  </Await>
);
`,
  },
  {
    value: 'server',
    label: 'Server rendering',
    title: 'Server rendering',
    body: 'Turn your pages into HTML at build time, so they show up before any JavaScript runs. In the browser, Retend picks up where the HTML left off.',
    filename: 'vite.config.ts',
    tags: ['SSR', 'SSG', 'Hydration', 'Metadata', 'Client boundaries'],
    href: '/docs/static-site-generation',
    linkLabel: 'Read about server rendering',
    code: `
import { defineConfig } from 'vite';
import { retend } from 'retend-web/plugins/vite';
import { retendSSG } from 'retend-server/plugin';

export default defineConfig({
  plugins: [
    retend(),
    retendSSG({
      pages: ['/', '/about'],
      routerModulePath: './source/router.ts',
    }),
  ],
});
`,
  },
  {
    value: 'scopes',
    label: 'Scopes',
    title: 'Scopes',
    body: 'Provide a value once, near the top of your app, and read it in any component below without passing it down by hand.',
    filename: 'User.tsx',
    tags: ['createScope', 'Providers', 'useScopeContext'],
    href: '/docs/context-and-scopes',
    linkLabel: 'Read about scopes',
    code: `
import { Cell, createScope, useScopeContext } from 'retend';

const UserScope = createScope('User');

function App() {
  const user = Cell.source({ name: 'Ada' });
  return (
    <UserScope.Provider value={user}>
      <Greeting />
    </UserScope.Provider>
  );
}

function Greeting() {
  const user = useScopeContext(UserScope);
  const name = Cell.derived(() => user.get().name);
  return <p>Hello, {name}</p>;
}
`,
  },
  {
    value: 'devtools',
    label: 'Devtools',
    title: 'Devtools',
    body: 'Open an inspector inside your running app to browse its components, check their props and see what each one put on the page. It is left out of production builds.',
    filename: 'main.tsx',
    tags: ['Component tree', 'Props', 'Highlighting'],
    href: '/docs/devtools',
    linkLabel: 'Read about devtools',
    code: `
import { renderToDOM } from 'retend-web';
import { RetendDevTools } from 'retend-web-devtools';

import App from './App';

renderToDOM(document.getElementById('app')!, () => (
  <RetendDevTools>
    <App />
  </RetendDevTools>
));
`,
  },
  {
    value: 'hmr',
    label: 'Hot reloading',
    title: 'Hot reloading',
    body: 'Save a file and the components you changed update in place, without reloading the page.',
    filename: 'vite.config.ts',
    tags: ['Vite', 'Rspack', 'Component updates'],
    href: '/docs/getting-started',
    linkLabel: 'Set up a project',
    code: `
import { defineConfig } from 'vite';
import { retend } from 'retend-web/plugins/vite';

// In development, the plugin swaps edited components in place.
export default defineConfig({
  plugins: [retend()],
});
`,
  },
] as const satisfies readonly FeatureDefinition[];

export type Feature = (typeof features)[number];
export type FeatureId = Feature['value'];

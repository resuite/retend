# retend-server (experimental)

`retend-server` is a Vite plugin that enables **static site generation (SSG)** for applications built with the `retend` library. It generates static HTML files for specified routes during the Vite build process, making your application suitable for static hosting while preserving reactivity and routing capabilities.

This plugin is ideal for projects requiring fast initial load times, SEO optimization, and deployment to static hosting services like Netlify, Vercel, or GitHub Pages.

> [!IMPORTANT]
> This plugin is currently in an experimental stage and may undergo significant changes. Use with caution. APIs and functionality _will_ change without notice.

## Installation

To get started with `retend-server`, install it as a development dependency in your Vite project:

```bash
npm install --save-dev retend-server
```

## Configuring the Plugin in Vite

Add the `retend-server` plugin to your Vite configuration file (`vite.config.js` or `vite.config.ts`) to enable static site generation. Below is a basic example:

```javascript
import { defineConfig } from 'vite';
import { retendSSG } from 'retend-server';

export default defineConfig({
  plugins: [
    retendSSG({
      pages: ['/', '/about', '/contact'],
      routerModulePath: './src/router.js',
    }),
  ],
});
```

### Configuration Options

- **`pages`** (Required)

  - Type: `string[]`
  - Description: An array of routes to generate static HTML files for.
  - Example: `['/', '/about', '/contact']`

- **`routerModulePath`** (Required)

  - Type: `string`
  - Description: The file path to the module exporting your `createRouter` function and `context`, which defines your application's routing logic.
  - Example: `'./src/router.js'`

### Updating the Application Entry Point

To make your static HTML interactive, update your application’s entry point (e.g., `src/main.js`) to use the `hydrate` function from `retend-server/client`. This step ensures your application becomes fully functional on the client side after the static content is loaded.

### Example: Application Entry Point (`src/main.js`)

```javascript
import { hydrate } from 'retend-server/client';
import { createRouter } from './router';

hydrate(createRouter)
  .then(() => {
    console.log('Application successfully hydrated!');
  })
  .catch((error) => {
    console.error('Hydration failed:', error);
  });

// Listen for the hydrationcompleted event to perform additional tasks
window.addEventListener('hydrationcompleted', () => {
  console.log('Hydration is complete, and the app is fully interactive.');
  // Add post-hydration logic here, like initializing analytics or other scripts
});
```

The `hydrationcompleted` event fires when hydration finishes, allowing you to execute additional logic (e.g., loading third-party scripts or tracking analytics) once the app is fully interactive.

After configuring the plugin, run the Vite build command to generate static HTML files in the output directory (typically `dist`):

```bash
vite build
```

## Example Setup

Here’s a complete example to tie it all together.

### Router Definition (`src/router.js`)

```javascript
import { createWebRouter } from 'retend/router';
import Home from './Home';
import About from './About';
import Contact from './Contact';

export * as context from 'retend/context';
export function createRouter() {
  return createWebRouter({
    routes: [
      { path: '/', component: Home },
      { path: '/about', component: About },
      { path: '/contact', component: Contact },
    ],
  });
}
```

### Vite Configuration (`vite.config.js`)

```javascript
import { defineConfig } from 'vite';
import { retendSSG } from 'retend-server';

export default defineConfig({
  plugins: [
    retendSSG({
      pages: ['/', '/about', '/contact'],
      routerModulePath: './src/router.js',
    }),
  ],
});
```

Running `vite build` generates static HTML files (`index.html`, `about.html`, `contact.html`) in the `dist` directory, each pre-rendered with the content for its route.

## Handling Redirects

If your router includes redirects (e.g., from `/old-path` to `/new-path`), the plugin generates additional HTML files with meta refresh tags. For example:

- A redirect from `/old-path` to `/new-path` creates `old-path.html`, redirecting to `new-path.html`.

This ensures redirects work seamlessly in a static hosting environment.

## Route Metadata

The `metadata` property allows you to define meta information for your routes that will be automatically managed in the document head. This is useful for SEO, social sharing, and other meta tag requirements.

### Basic Usage

```javascript
export function createRouter() {
  return createWebRouter({
    routes: [
      {
        path: '/',
        component: Home,
        metadata: {
          title: 'Home Page',
          description: 'Welcome to our website',
          charset: 'UTF-8',
          lang: 'en',
        },
      },
    ],
  });
}
```

### Dynamic Metadata

You can make metadata dynamic by using a function that receives route data:

```javascript
{
  path: '/products/:id',
  component: ProductPage,
  metadata: (data) => ({
    title: `Product ${data.params.get('id')}`,
    description: 'Product details page',
    ogImage: `https://example.com/products/${data.params.get('id')}/image.jpg`
  })
}
```

### Async Metadata

For metadata that requires asynchronous operations:

```javascript
{
  path: '/blog/:id',
  component: BlogPost,
  metadata: async (data) => {
    const response = await fetch(`/api/posts/${data.params.get('id')}`);
    const post = await response.json();
    return {
      title: post.title,
      description: post.excerpt,
      ogImage: post.featuredImage
    };
  }
}
```

### Component-Level Metadata

You can also define metadata directly on your components:

```javascript
const BlogPost = () => {
  return <div>Blog content</div>;
};

BlogPost.metadata = {
  title: 'Blog Post',
  description: 'An interesting blog post',
};

// Or dynamically:
BlogPost.metadata = (data) => ({
  title: `Post ${data.params.get('id')}`,
  description: 'Dynamic blog post description',
});
```

### Supported Metadata Properties

- `title`: Sets the page title
- `description`: Meta description for SEO
- `charset`: Character encoding (e.g., 'UTF-8')
- `lang`: Document language (e.g., 'en')
- `keywords`: Meta keywords for SEO
- `author`: Content author
- `viewport`: Viewport configuration
- `themeColor`: Theme color for mobile browsers

#### Open Graph Properties

- `ogTitle`: Open Graph title
- `ogDescription`: Open Graph description
- `ogImage`: Open Graph image URL
- `ogUrl`: Canonical URL
- `ogType`: Content type
- `ogLocale`: Content locale
- `ogSiteName`: Site name

#### Twitter Card Properties

- `twitterCard`: Twitter card type
- `twitterTitle`: Twitter title
- `twitterDescription`: Twitter description
- `twitterImage`: Twitter card image
- `misc`: Additional data that can be used by third-party services.

### Metadata Inheritance

When using nested routes, metadata is inherited and merged from parent to child routes. Child route metadata will override parent metadata for duplicate properties:

```javascript
{
  path: '/dashboard',
  component: Dashboard,
  metadata: {
    section: 'Admin',
    requiresAuth: true
  },
  children: [
    {
      path: 'users',
      component: Users,
      metadata: {
        title: 'User Management',
        description: 'Manage system users'
      }
    }
  ]
}
```

In this example, the '/dashboard/users' route will have both the parent's metadata (`section` and `requiresAuth`) and its own metadata (`title` and `description`).

## Development vs. Production

- **Development Mode**: When running `vite dev` (`import.meta.env.DEV` is `true`), the `hydrate` function switches to single-page application (SPA) mode, rendering the app client-side without server-side rendering for faster development.
- **Production Mode**: After `vite build`, the `hydrate` function uses the pre-rendered HTML, enabling fast initial loads and better SEO.

## Deployment

Once built, deploy the `dist` directory to any static hosting service, such as:

- GitHub Pages
- Netlify
- Vercel

For static routes, no additional server setup is needed. For dynamic routes (e.g., `/post/:id`), list all possible paths in the `pages` array (e.g., `['/post/1', '/post/2']`).

## Prerequisites

- **Vite**: Required as the build tool.
- **`retend`**: The core library for your application.
- **Router**: Must use `retend/router`, exported from the module specified in `routerModulePath`.

## Notes

- Generated HTML files include scripts and styles as configured in your Vite build.
- The plugin assumes your app uses `retend` for routing and reactivity.

## Documentation

For more on `retend`, see the [main documentation](https://github.com/adebola-io/retend/blob/main/docs/README.md).

## License

Licensed under the MIT License. See the [LICENSE](https://github.com/adebola-io/retend/blob/main/LICENSE) file.

## getServerSnapshot

The `getServerSnapshot` function allows you to access data generated during build or server-side rendering (SSR) from a specified module.

Use this in client components to access results from server-only logic that was executed _once_ during the build/SSR phase. The results are embedded in the client bundle or SSR payload.

Calling a function on the returned object provides the _pre-computed result_ captured during build/SSR; the original function is _not_ re-executed on the client.

**Constraints:**

- The target module is executed _only_ during build/SSR.
- Only JSON-serializable data is transferred: raw values and the _resolved, serializable return values_ of functions executed during build/SSR. Functions themselves, unresolved Promises, Maps, Sets, etc., are not transferred.

**Example:**

```javascript
// config.server.js (runs during build/SSR)
export const buildTimestamp = new Date().toISOString();

export async function getFeatureFlags() {
  // In a real app, fetch this from a service or env vars
  return {
    newDashboard: true,
    betaFeatureX: false,
  };
}

// FeatureDisplay.jsx (runs on the client)
import { getServerSnapshot } from 'retend-server';

async function FeatureDisplay() {
  const serverConfig = await getServerSnapshot(() =>
    import('./config.server.js')
  );
  const { buildTimestamp, getFeatureFlags } = serverConfig;
  const flags = await getFeatureFlags(); // Gets the pre-computed flags

  return (
    <div>
      <p>Build Time: {buildTimestamp}</p>
      <p>
        New Dashboard Enabled:{' '}
        {If(flags.newDashboardEnabled, {
          true: () => 'Yes',
          false: () => 'No',
        })}
      </p>
    </div>
  );
}
```

## Contributing

Contributions are welcome! Check the [contributing guidelines](https://github.com/adebola-io/retend/blob/main/CONTRIBUTING.md) for details.

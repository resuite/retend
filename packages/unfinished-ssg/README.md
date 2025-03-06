# unfinished-ssg (experimental)

`unfinished-ssg` is a Vite plugin that enables **static site generation (SSG)** for applications built with the `@adbl/unfinished` library. It generates static HTML files for specified routes during the Vite build process, making your application suitable for static hosting while preserving reactivity and routing capabilities.

This plugin is ideal for projects requiring fast initial load times, SEO optimization, and deployment to static hosting services like Netlify, Vercel, or GitHub Pages.

> [!IMPORTANT]
> This plugin is currently in an experimental stage and may undergo significant changes. Use with caution. APIs and functionality _will_ change without notice.

## Installation

To get started with `unfinished-ssg`, install it as a development dependency in your Vite project:

```bash
npm install --save-dev @adbl/unfinished-ssg
```

## Configuring the Plugin in Vite

Add the `unfinished-ssg` plugin to your Vite configuration file (`vite.config.js` or `vite.config.ts`) to enable static site generation. Below is a basic example:

```javascript
import { defineConfig } from 'vite';
import unfinishedSSG from '@adbl/unfinished-ssg';

export default defineConfig({
  plugins: [
    unfinishedSSG({
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
  - Description: The file path to the module exporting your `createRouter` function, which defines your application's routing logic.
  - Example: `'./src/router.js'`

### Updating the Application Entry Point

To make your static HTML interactive, update your application’s entry point (e.g., `src/main.js`) to use the `hydrate` function from `@adbl/unfinished-ssg/client`. This step ensures your application becomes fully functional on the client side after the static content is loaded.

### Example: Application Entry Point (`src/main.js`)

```javascript
import { hydrate } from '@adbl/unfinished-ssg/client';
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
import { createWebRouter } from '@adbl/unfinished/router';
import Home from './Home';
import About from './About';
import Contact from './Contact';

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
import unfinishedSSG from '@adbl/unfinished-ssg';

export default defineConfig({
  plugins: [
    unfinishedSSG({
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
- **`@adbl/unfinished`**: The core library for your application.
- **Router**: Must use `@adbl/unfinished/router`, exported from the module specified in `routerModulePath`.

## Notes

- Generated HTML files include scripts and styles as configured in your Vite build.
- The plugin assumes your app uses `@adbl/unfinished` for routing and reactivity.

## Documentation

For more on `@adbl/unfinished`, see the [main documentation](https://github.com/adebola-io/unfinished/blob/main/docs/README.md).

## License

Licensed under the MIT License. See the [LICENSE](https://github.com/adebola-io/unfinished/blob/main/LICENSE) file.

## Contributing

Contributions are welcome! Check the [contributing guidelines](https://github.com/adebola-io/unfinished/blob/main/CONTRIBUTING.md) for details.

# retend

> Retend is not ready for any production use. Implement it at your own discretion.

Retend is an experimental framework for building fluid web apps. Like React, it allows you to use JSX to create dynamic user interfaces.

If you've worked with HTML, CSS, and JavaScript, Retend should be easy to pick up. It is designed to help you build applications quickly and efficiently.

## At a Glance:

```tsx
import { Cell } from 'retend';
import { renderToDOM } from 'retend-web';

const App = () => {
  const count = Cell.source(0);
  const incrementCount = () => count.set(count.get() + 1);

  return (
    <div class="container">
      <button type="button" onClick={incrementCount}>
        Counter: {count}
      </button>
    </div>
  );
};

const root = document.getElementById('app')!;
renderToDOM(root, App);
```

## Key Features

- Lightweight: Retend has a small footprint, which means it loads quickly without extra overhead.

- JSX Support: You can use JSX to define your user interfaces. This allows you embed HTML-like structures directly into JavaScript.

- Built-in Reactivity: [`@adbl/cells`](https://github.com/adebola-io/cells) is used for reactivity. This means that parts of your UI that depend on data will automatically update, without the need for manual triggering or rerenders.

- Platform Agnostic by Default: Retend's core reactivity is decoupled from the browser. The default web renderer (`retend-web`) maps components directly to DOM elements.
  - There is no Virtual DOM.
  - There is no "re-render".

  This gives you a high level of control and maximizes performance without an extra intermediary layer.

- Built-in Router: Retend includes its own router, which makes it easier to build single-page applications. The router handles navigation between parts of your app without full page reloads.

- (Experimental) HMR Support: Retend supports hot module reloads, which allow you to see changes instantly without refreshing the page. This speeds up development by letting you focus more on your application.

- (Experimental) SSG support: Retend supports statically generating a select group of paths of your application.

## Installation

Install Node.js first. `npm` ships with Node.js, so you can start with the default package manager and switch to `pnpm` or `bun` later if you prefer.

The recommended alpha setup path is:

```bash
npx retend-start@latest my-app
cd my-app
npm install
npm run dev
```

Then open `http://localhost:5229`.

By default, the scaffold creates a TypeScript app with CSS modules, built-in routing, and client-side rendering.

Optional flags:

- `--default`: skip prompts and use the default starter
- `--tailwind`: enable Tailwind CSS
- `--javascript`: use JavaScript instead of TypeScript
- `--ssg`: enable static site generation
- `--docs`: include `.docs` and `AGENT.md` files for AI assistants

Example:

```bash
npx retend-start@latest my-app --tailwind --ssg
```

## Documentation

Documentation lives at [retend.dev](https://retend.dev).

## License

MIT

## Contributing

Contributions are welcome! Please read the [contributing guidelines](https://github.com/resuite/retend/blob/main/CONTRIBUTING.md) for more information.

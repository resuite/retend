# retend

[![npm version](https://badge.fury.io/js/retend.svg)](https://badge.fury.io/js/retend)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/resuite/retend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A modern reactive framework for building fluid web applications.**

> ⚠️ **Alpha Software**: Retend is currently in alpha and not recommended for production use.

Retend is a reactive JavaScript framework that uses JSX to build dynamic user interfaces. Unlike traditional frameworks, Retend components run exactly once—no re-renders, no Virtual DOM. Updates happen automatically and precisely where data changes.

If you're familiar with HTML, CSS, and JavaScript, you'll feel right at home with Retend.

## Why Retend?

- **No Virtual DOM**: Retend maps components directly to real DOM elements, eliminating the overhead of maintaining a separate virtual tree.

- **No Re-renders**: Components execute exactly once. When data changes, only the specific DOM nodes that depend on that data update automatically.

- **Fine-grained Reactivity**: Built on [`@adbl/cells`](https://github.com/adebola-io/cells), Retend tracks dependencies automatically and updates only what needs to change.

- **Platform Agnostic**: The core reactivity system is decoupled from the browser. Swap renderers to target web (`retend-web`), server-side (`retend-server`), or even custom platforms.

## At a Glance

```tsx
import { Cell } from 'retend';
import { renderToDOM } from 'retend-web';

const App = () => {
  const count = Cell.source(0);
  const increment = () => count.set(count.get() + 1);

  return (
    <div>
      <button type="button" onClick={increment}>
        Count: {count}
      </button>
    </div>
  );
};

const root = document.getElementById('app')!;
renderToDOM(root, App);
```

## Key Features

### Core

- **JSX Support**: Write HTML-like syntax directly in JavaScript for intuitive component design.
- **Fine-grained Reactivity**: Wrap data in Cells. When data changes, the DOM updates automatically—no manual triggers needed.
- **Control Flow**: Built-in `If`, `For`, and `Switch` functions for conditional rendering and lists.
- **Context & Scopes**: Share state across your component tree without prop drilling.
- **Lifecycle Hooks**: `onMount`, `onCleanup`, and other hooks for side effects.

### Routing

- **Built-in Router**: Programmatic routing for single-page applications with `defineRoutes`.
- **Navigation Guards**: Middleware support for route protection and redirects.
- **Lazy Loading**: Code-split routes for faster initial loads.
- **Query Parameters**: Built-in support for URL search params.
- **View Transitions**: Smooth animated transitions between routes.

### Performance

- **Direct DOM Updates**: No Virtual DOM means faster rendering with less memory overhead.
- **Components Run Once**: No diffing or reconciliation on every change.
- **Tree Shaking**: Import only what you need for smaller bundles.
- **Lightweight Core**: Minimal footprint for fast page loads.

### Developer Experience

- **TypeScript Support**: Full TypeScript support with type inference.
- **Hot Module Replacement**: See changes instantly during development.
- **Static Site Generation**: Pre-render pages for optimal performance and SEO.
- **DevTools**: Debug your applications with dedicated browser extensions.

## Package Ecosystem

Retend is organized into focused packages:

| Package               | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `retend`              | Core library with reactivity, JSX, control flow, and routing |
| `retend-web`          | DOM renderer for browser applications                        |
| `retend-server`       | Server-side rendering and static site generation             |
| `retend-start`        | CLI tool for scaffolding new projects                        |
| `retend-utils`        | Utility functions and helpers                                |
| `retend-web-devtools` | Browser DevTools integration                                 |

## Installation

Install Node.js first. `npm` ships with Node.js, so you can start with the default package manager and switch to `pnpm` or `bun` later if you prefer.

```bash
npx retend-start@latest my-app
cd my-app
npm install
npm run dev
```

Open `http://localhost:5229` in your browser.

The scaffold creates a TypeScript app with CSS modules, built-in routing, and client-side rendering by default.

### CLI Options

| Flag           | Description                                             |
| -------------- | ------------------------------------------------------- |
| `--default`    | Skip prompts and use default configuration              |
| `--tailwind`   | Enable Tailwind CSS                                     |
| `--javascript` | Use JavaScript instead of TypeScript                    |
| `--ssg`        | Enable static site generation                           |
| `--docs`       | Include `.docs` folder and `AGENT.md` for AI assistants |

```bash
npx retend-start@latest my-app --tailwind --ssg
```

## Documentation

Visit [retend.dev](https://retend.dev) for comprehensive documentation including:

- Getting Started Guide
- Reactivity Deep Dive
- Component Patterns
- Routing & Navigation
- Static Site Generation
- API Reference

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please read the [contributing guidelines](https://github.com/resuite/retend/blob/main/CONTRIBUTING.md) for more information.

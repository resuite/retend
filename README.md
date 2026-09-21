# retend

[![npm version](https://badge.fury.io/js/retend.svg)](https://badge.fury.io/js/retend)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/resuite/retend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A reactive UI framework with a renderer-independent core.**

> Retend is alpha software. APIs may change before the first stable release.

Retend uses JSX and reactive [`Cell`](https://github.com/adebola-io/cells) values to build interfaces. The core does not depend on the browser or the DOM. Instead, a renderer implements the operations needed to create nodes, set properties, insert content, and update existing output.

## Render targets

The same components and reactive state can drive more than one host:

- **Browser**: [`retend-web`](https://github.com/resuite/retend/tree/main/packages/retend-web) renders to DOM nodes.
- **Server**: [`retend-server`](https://github.com/resuite/retend/tree/main/packages/retend-server) renders to HTML for server-side rendering and static generation, then hydrates in the browser.
- **Native desktop**: [`retend-gpui`](https://github.com/resuite/retend/tree/main/packages/retend-gpui) renders to a native OS window through GPUI. This renderer is experimental.

Component functions run when their instances are mounted. Retend does not re-run an entire component tree when state changes. It tracks the reactive values used by each binding and updates the affected output directly. Dynamic collections use the renderer’s reconciliation API when their contents change.

## Core concepts

- **Renderer-independent core**: `retend` contains the JSX runtime, reactive bindings, control-flow helpers, routing, and renderer interfaces. A renderer maps those operations to a host environment such as the DOM or a server-side representation.
- **One-time component setup**: A component function runs to create its output and establish its reactive bindings. Later state changes update those bindings instead of re-running the component.
- **Fine-grained updates**: Changes to a `Cell` notify only the bindings that depend on it. The renderer then updates the corresponding text, property, attribute, or collection.
- **Built-in primitives**: The core includes `If`, `For`, and `Switch` for conditional and list rendering, as well as a programmatic router and scope-based context utilities.

## At a glance

Application code can be written independently of the output platform:

```tsx
import { Cell } from 'retend';

const App = () => {
  const count = Cell.source(0);

  return (
    <button type="button" onClick={() => count.set(count.get() + 1)}>
      Count: {count}
    </button>
  );
};
```

For a browser application, use the DOM renderer’s `renderToDOM` helper to mount the component:

```tsx
import { renderToDOM } from 'retend-web';

renderToDOM(document.getElementById('app')!, App);
```

If you need to control the renderer directly, `retend-web` also exports `DOMRenderer`. Other renderers can implement the core `Renderer` interface for different host environments.

## Quick start

Scaffold a browser project with the CLI:

```bash
pnpm dlx retend-start@latest my-app
cd my-app
pnpm install
pnpm run dev
```

CLI options include `--tailwind`, `--ssg`, `--javascript`, `--docs`, and `--default`.

## Package ecosystem

The project is split into packages with separate responsibilities:

- **`retend`**: The renderer-independent core, including reactivity, JSX, control flow, and routing.
- **`retend-web`**: The DOM renderer for browser applications.
- **`retend-server`**: Server-side rendering and static site generation support.
- **`retend-gpui`**: Experimental native desktop renderer backed by GPUI.
- **`retend-start`**: CLI for scaffolding new Retend projects.
- **`retend-utils`**: Utility functions, hooks, and reusable components.
- **`retend-web-devtools`**: Development tools for inspecting Retend web applications.
- **`retend-oxlint-plugin`**: Oxlint rules that enforce Retend idioms.

## Links

- **Documentation**: [retend.dev](https://retend.dev)
- **Contributing**: [CONTRIBUTING.md](https://github.com/resuite/retend/blob/main/CONTRIBUTING.md)
- **License**: [MIT](LICENSE)

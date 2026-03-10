# retend

[![npm version](https://badge.fury.io/js/retend.svg)](https://badge.fury.io/js/retend)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/resuite/retend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A universal, renderer-agnostic reactive framework for building fluid user interfaces.**

> ⚠️ **Alpha Software**: Retend is currently in early development and not recommended for production use.

Retend is a modern reactive framework that uses JSX to construct dynamic interfaces on _any_ platform. Unlike traditional frameworks, Retend components run exactly once—there is no Virtual DOM, no diffing phase, and no component re-renders.

Instead, Retend acts as an orchestration engine between its reactive primitive (`Cell`) and a pluggable `Renderer` interface, ensuring that state changes translate instantly to precise node updates in the target environment.

## Core Concepts

- **Renderer-Agnostic Engine**: The core reactivity and JSX transform (`retend`) have zero knowledge of the browser. You configure a `Renderer` interface (like `DOMRenderer` for the web, or a custom one for Canvas, Terminal, or Mobile) to map universal instructions to platform-specific nodes.
- **Run-Once Components**: Components are not diffed or reconciled. They execute exactly once to establish reactive bindings between state and the active renderer.
- **Surgical Reactivity**: Built around [`@adbl/cells`](https://github.com/adebola-io/cells), dependencies are automatically tracked. State changes directly command the renderer to update only the specific nodes that changed.
- **Batteries Included**: Despite being renderer-agnostic, the core library ships with universal primitives like a programmatic router, control flow components (`If`, `For`, `Switch`), and robust scope context injection.

## At a Glance

Your application logic and JSX are completely decoupled from the platform:

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

To display it, simply pass the component tree to your environment's specific renderer:

```tsx
import { DOMRenderer, setActiveRenderer } from 'retend-web';

const renderer = new DOMRenderer(window);
setActiveRenderer(renderer);

const rootNode = renderer.render(<App />);

document.getElementById('app')!.append(rootNode);
```

_(Note: `retend-web` provides a `renderToDOM` helper to simplify this for browser projects!)_

## Quick Start

The fastest way to scaffold a browser project is using our CLI:

```bash
npx retend-start@latest my-app
cd my-app
npm install
npm run dev
```

_CLI Options: `--tailwind`, `--ssg`, `--javascript`, `--docs`, `--default`_

## Package Ecosystem

Retend's architecture is split to enforce separation of concerns:

- **`retend`**: The universal core library (reactivity, JSX, control flow, routing).
- **`retend-web`**: The official DOM renderer implementation for browser applications.
- **`retend-server`**: Server-side rendering (SSR) and static site generation (SSG) implementations.
- **`retend-start`**: CLI tool for scaffolding new projects.
- **`retend-utils`**: Utility functions and universal hooks.
- **`retend-web-devtools`**: Browser extension integration for inspecting the DOM renderer.

## Links

- **Documentation**: [retend.dev](https://retend.dev)
- **Contributing**: [CONTRIBUTING.md](https://github.com/resuite/retend/blob/main/CONTRIBUTING.md)
- **License**: [MIT](LICENSE)

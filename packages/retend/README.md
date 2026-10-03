# retend

[![npm version](https://img.shields.io/npm/v/retend?color=blue)](https://www.npmjs.com/package/retend)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/resuite/retend)

> Retend is alpha software. APIs may change before the first stable release.

A reactive UI framework with a renderer-independent core. Retend provides the JSX runtime, reactive primitives, control flow, and routing, and stays decoupled from any platform through an abstract `Renderer` interface.

## What is Retend?

Retend is a JSX framework whose core never touches the DOM. Write components and reactive state once, then render them to more than one host:

- **Browser**: [`retend-web`](https://github.com/resuite/retend/tree/main/packages/retend-web) renders to DOM nodes.
- **Server**: [`retend-server`](https://github.com/resuite/retend/tree/main/packages/retend-server) renders to HTML for SSR and static generation, then hydrates in the browser.
- **Native desktop**: [`retend-gpui`](https://github.com/resuite/retend/tree/main/packages/retend-gpui) renders to a native OS window through GPUI. This renderer is experimental.

## Key Concepts

- Fine-grained Reactivity: Changes propagate automatically to only the affected nodes in the renderer's tree — no Virtual DOM diffing or full component re-renders
- Components are Functions: No component instances or reconciliation layers — just direct node creation and surgical updates
- Renderer-Agnostic: Works across environments (DOM, SSR, etc.) by swapping the renderer implementation

## Installation

```bash
npm install retend retend-web
```

Or use the scaffolding tool for new projects:

```bash
npx retend-start@latest my-app
```

## Quick Example

```tsx
import { Cell } from 'retend';
import { renderToDOM } from 'retend-web';

const Counter = () => {
  const count = Cell.source(0);
  return (
    <button onClick={() => count.set(count.get() + 1)}>Count: {count}</button>
  );
};

const root = document.getElementById('app')!;
renderToDOM(root, Counter);
```

## Module Exports

```tsx
// Core (reactivity, control flow, lifecycle)
import { Cell, For, If, Switch, onSetup } from 'retend';

// Router
import { Router, Link, Outlet, useRouter } from 'retend/router';

// Environment management
import { setGlobalContext, getGlobalContext } from 'retend/context';
```

## Documentation

For setup, examples, and API guides, start with [retend.dev](https://retend.dev).

## License

MIT © [Adebola Akomolafe](https://github.com/adebola-io)

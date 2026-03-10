# retend

[![npm version](https://img.shields.io/npm/v/retend?color=blue)](https://www.npmjs.com/package/retend)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/resuite/retend)

> Retend is experimental and not ready for production use.

The core reactive framework for building user interfaces with JSX. Retend provides a renderer-agnostic foundation with fine-grained reactivity and built-in routing.

## What is Retend?

Retend is a renderer-agnostic reactive UI framework. It provides the building blocks for creating dynamic interfaces while remaining decoupled from any specific platform through an abstract `Renderer` interface.

For browser applications, use it with [`retend-web`](https://github.com/resuite/retend/tree/main/packages/retend-web) (the DOM renderer).

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

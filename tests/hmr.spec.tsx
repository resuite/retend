import type { DOMRenderer } from 'retend-web';

import { Cell, getActiveRenderer } from 'retend';
import { hotReloadModule, withHMRBoundaries } from 'retend-web/plugins/hmr';
import { describe, expect, it } from 'vitest';

import { browserSetup } from './setup.tsx';

browserSetup();

describe('retend-web component HMR boundaries', () => {
  it('keeps the previous component alive after a failed HMR render', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { document } = renderer.host;

    const counter = Cell.source(0);
    function App() {
      return <div>{counter}</div>;
    }
    function BrokenApp(): unknown {
      throw new Error('broken update');
    }
    function FixedApp() {
      return <div>after</div>;
    }

    const rendered = renderer.render(() =>
      withHMRBoundaries(App, [], undefined, renderer)
    );
    document.body.append(...(Array.isArray(rendered) ? rendered : [rendered]));

    expect(document.body.textContent).toBe('0');

    await hotReloadModule({ default: BrokenApp }, { default: App });
    expect(document.body.textContent).toBe('0');

    counter.set(1);
    expect(document.body.textContent).toBe('1');

    await hotReloadModule({ default: FixedApp }, { default: BrokenApp });
    expect(document.body.textContent).toBe('after');
  });

  it('updates every component exported by a hot-updated module', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { document } = renderer.host;

    function First() {
      return <span>first</span>;
    }
    function Second() {
      return <span>second</span>;
    }
    function NextFirst() {
      return <span>next-first</span>;
    }
    function NextSecond() {
      return <span>next-second</span>;
    }

    for (const component of [First, Second]) {
      const rendered = renderer.render(() =>
        withHMRBoundaries(component, [], undefined, renderer)
      );
      document.body.append(
        ...(Array.isArray(rendered) ? rendered : [rendered])
      );
    }
    expect(document.body.textContent).toBe('firstsecond');

    await hotReloadModule(
      { First: NextFirst, Second: NextSecond },
      { First, Second }
    );
    expect(document.body.textContent).toBe('next-firstnext-second');
  });

  it('updates an ancestor after a pass-through child was hot-updated', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { document } = renderer.host;

    function Leaf() {
      return <div>leaf</div>;
    }
    function Middle() {
      return withHMRBoundaries(Leaf, [], undefined, renderer);
    }
    function Top() {
      return withHMRBoundaries(Middle, [], undefined, renderer);
    }
    // Re-renders Middle, which replaces the Leaf instance Top was anchored to.
    function NextMiddle() {
      return withHMRBoundaries(Leaf, [], undefined, renderer);
    }
    function NextTop() {
      return <p>top</p>;
    }

    const rendered = renderer.render(() =>
      withHMRBoundaries(Top, [], undefined, renderer)
    );
    document.body.append(...(Array.isArray(rendered) ? rendered : [rendered]));
    expect(document.body.textContent).toBe('leaf');

    await hotReloadModule({ Middle: NextMiddle }, { Middle });
    expect(document.body.textContent).toBe('leaf');

    await hotReloadModule({ Top: NextTop }, { Top });
    expect(document.body.textContent).toBe('top');
  });
});

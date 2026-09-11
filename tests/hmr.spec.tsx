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
});

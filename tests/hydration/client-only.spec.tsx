import { Cell, createUnique, runPendingSetupEffects } from 'retend';
import { ClientOnly } from 'retend-server';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup, render, vDomSetup } from '../setup.tsx';
import {
  renderHydrationServerHtml,
  setupHydration,
} from './hydration-helpers.tsx';

describe('ClientOnly', () => {
  describe('SSR (serialization)', () => {
    vDomSetup({ markDynamicNodes: true });

    it('should render nothing when no fallback is provided', () => {
      const template = () => (
        <div id="root">
          <ClientOnly>
            <span id="client-content">Client</span>
          </ClientOnly>
        </div>
      );

      const rendered = render(template) as unknown as Element;
      expect(rendered.querySelector('#client-content')).toBeNull();
    });

    it('should render fallback during SSR', () => {
      const template = () => (
        <div id="root">
          <ClientOnly fallback={<span id="fallback">Loading...</span>}>
            <span id="client-content">Client</span>
          </ClientOnly>
        </div>
      );

      const rendered = render(template) as unknown as Element;
      expect(rendered.querySelector('#fallback')).not.toBeNull();
      expect(rendered.querySelector('#client-content')).toBeNull();
    });

    it('should serialize fallback content to HTML string', async () => {
      const template = () => (
        <div id="root">
          <ClientOnly fallback={<div id="ssr-fallback">Placeholder</div>}>
            <div id="ssr-client">Real Content</div>
          </ClientOnly>
        </div>
      );

      const html = await renderHydrationServerHtml(template);
      expect(html).toContain('Placeholder');
      expect(html).toContain('ssr-fallback');
      expect(html).not.toContain('ssr-client');
      expect(html).not.toContain('Real Content');
    });
  });

  describe('Hydration', () => {
    browserSetup();

    it('should swap from fallback to children after hydration', async () => {
      const template = () => (
        <div id="root">
          <ClientOnly fallback={<span id="fallback">Loading...</span>}>
            <span id="client-content">Client</span>
          </ClientOnly>
        </div>
      );

      const { document } = await setupHydration(template);
      await runPendingSetupEffects();

      expect(document.querySelector('#fallback')).toBeNull();
      expect(document.querySelector('#client-content')).not.toBeNull();
      expect(document.querySelector('#client-content')?.textContent).toBe(
        'Client'
      );
    });

    it('should show children when no fallback is provided', async () => {
      const template = () => (
        <div id="root">
          <ClientOnly>
            <div id="client-only-content">Visible</div>
          </ClientOnly>
        </div>
      );

      const { document } = await setupHydration(template);
      await runPendingSetupEffects();

      expect(document.querySelector('#client-only-content')).not.toBeNull();
      expect(document.querySelector('#client-only-content')?.textContent).toBe(
        'Visible'
      );
    });

    it('should hydrate without errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const template = () => (
        <div id="root">
          <ClientOnly fallback={<p id="fb">Loading</p>}>
            <p id="real">Loaded</p>
          </ClientOnly>
        </div>
      );

      await setupHydration(template);
      await runPendingSetupEffects();

      const errorCalls = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Hydration error')
      );
      expect(errorCalls.length).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should support reactive children after mount', async () => {
      const count = Cell.source(0);

      const template = () => (
        <div id="root">
          <ClientOnly fallback={<span>Loading...</span>}>
            <button
              id="counter-btn"
              type="button"
              onClick={() => count.set(count.get() + 1)}
            >
              Count: {count}
            </button>
          </ClientOnly>
        </div>
      );

      const { document } = await setupHydration(template);
      await runPendingSetupEffects();

      const btn = document.querySelector('#counter-btn') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Count: 0');

      btn.click();
      expect(btn.textContent).toBe('Count: 1');
    });

    it('should hydrate within a unique subtree without range errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const Stage = createUnique(() => {
        return (
          <ClientOnly>
            <div id="client-only-unique">Visible</div>
          </ClientOnly>
        );
      });
      const template = () => (
        <div id="root">
          <Stage />
        </div>
      );

      const { document } = await setupHydration(template);
      await runPendingSetupEffects();

      const errorCalls = consoleSpy.mock.calls.map((call) =>
        call.map(String).join(' ')
      );
      consoleSpy.mockRestore();

      expect(
        errorCalls.some((message) => message.includes('Hydration error'))
      ).toBe(false);
      expect(
        errorCalls.some((message) =>
          message.includes('after is not a function')
        )
      ).toBe(false);
      expect(document.querySelector('#client-only-unique')?.textContent).toBe(
        'Visible'
      );
    });

    it('should work alongside other hydrated content', async () => {
      const text = Cell.source('Dynamic');

      const template = () => (
        <div id="root">
          <span id="normal-content">{text}</span>
          <ClientOnly fallback={<span id="co-fb">FB</span>}>
            <span id="co-content">Client Only</span>
          </ClientOnly>
          <span id="after-content">Static</span>
        </div>
      );

      const { document } = await setupHydration(template);
      await runPendingSetupEffects();

      expect(document.querySelector('#normal-content')?.textContent).toBe(
        'Dynamic'
      );
      expect(document.querySelector('#co-content')).not.toBeNull();
      expect(document.querySelector('#co-fb')).toBeNull();
      expect(document.querySelector('#after-content')?.textContent).toBe(
        'Static'
      );

      text.set('Updated');
      expect(document.querySelector('#normal-content')?.textContent).toBe(
        'Updated'
      );
    });
  });

  describe('SPA (no hydration)', () => {
    browserSetup();

    it('should render children directly in SPA mode', async () => {
      const template = () => (
        <div id="root">
          <ClientOnly fallback={<span id="spa-fb">Loading</span>}>
            <span id="spa-content">SPA Content</span>
          </ClientOnly>
        </div>
      );

      const root = render(template);
      document.body.append(root);
      await runPendingSetupEffects();

      expect(document.querySelector('#spa-content')).not.toBeNull();
      expect(document.querySelector('#spa-fb')).toBeNull();
    });
  });
});

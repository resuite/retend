import type { DOMRenderer } from 'retend-web';

import { Cell, createScope, getActiveRenderer, useScopeContext } from 'retend';
import { Teleport } from 'retend-web';
import { assert, describe, expect, it, vi } from 'vitest';

import { browserSetup, getTextContent } from './setup.tsx';

describe('Teleport', () => {
  describe('Browser', () => {
    browserSetup();

    it('should teleport content to a target element by ID', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      // Create target element
      const target = window.document.createElement('div');
      target.setAttribute('id', 'teleport-target');
      window.document.body.append(target);

      const App = () => (
        <div>
          <Teleport to="#teleport-target">
            <div>Teleported content</div>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;

      window.document.body.append(result);

      // The anchor should be in the original location
      expect(result.tagName).toBe('DIV');

      renderer.observer?.flush();

      // The teleported content should be in the target
      const teleported = target.querySelector('retend-teleport');
      assert(teleported);
      expect(getTextContent(teleported)).toBe('Teleported content');
    });

    it('should teleport content to a target element by tag name', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      // Create target element
      const target = window.document.createElement('section');
      window.document.body.append(target);

      const App = () => (
        <div>
          <Teleport to="section">
            <div>Teleported to section</div>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;

      window.document.body.append(result);

      renderer.observer?.flush();

      // The teleported content should be in the target
      const teleported = target.querySelector('retend-teleport');
      assert(teleported);
      expect(getTextContent(teleported)).toBe('Teleported to section');
    });

    it('should handle dynamic content updates', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      // Create target element
      const target = window.document.createElement('div');
      target.id = 'dynamic-target';
      window.document.body.append(target);

      const content = Cell.source('Initial content');

      const App = () => (
        <div>
          <Teleport to="#dynamic-target">
            <div>{content}</div>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;

      window.document.body.append(result);

      renderer.observer?.flush();

      const teleported = target.querySelector('retend-teleport');
      assert(teleported);
      expect(getTextContent(teleported)).toBe('Initial content');

      content.set('Updated content');
      expect(getTextContent(teleported)).toBe('Updated content');
    });

    it('should log error when target is not found', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const App = () => (
        <div>
          <Teleport to="#nonexistent-target">
            <div>Content</div>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;

      window.document.body.append(result);

      renderer.observer?.flush();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not find teleport target, #nonexistent-target is not a matched id or tagname in the DOM.'
      );

      consoleSpy.mockRestore();
    });

    it('should handle multiple teleports to the same target', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      // Create target element
      const target = window.document.createElement('div');
      target.id = 'multi-target';
      window.document.body.append(target);

      const App = () => (
        <div>
          <Teleport to="#multi-target">
            <div>First teleport</div>
          </Teleport>
          <Teleport to="#multi-target">
            <div>Second teleport</div>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;

      window.document.body.append(result);

      renderer.observer?.flush();

      // Both teleports should be in the target
      const teleports = target.querySelectorAll('retend-teleport');
      expect(teleports.length).toBe(2);
      expect(getTextContent(teleports[0])).toBe('First teleport');
      expect(getTextContent(teleports[1])).toBe('Second teleport');
    });

    it('should preserve scope context for teleported children', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      const target = window.document.createElement('div');
      target.id = 'scope-target';
      window.document.body.append(target);

      const Scoped = createScope<string>('TeleportScopedValue');
      const ScopedText = () => {
        const value = useScopeContext(Scoped);
        return <span>{value}</span>;
      };

      const App = () => (
        <Scoped.Provider value="Scoped value">
          <div>
            <Teleport to="#scope-target">
              <ScopedText />
            </Teleport>
          </div>
        </Scoped.Provider>
      );

      const result = renderer.render(App) as HTMLElement;
      window.document.body.append(result);

      renderer.observer?.flush();

      const teleported = target.querySelector('retend-teleport');
      assert(teleported);
      expect(getTextContent(teleported)).toBe('Scoped value');
    });

    it('should link teleport anchor comment to teleported container', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;

      const target = window.document.createElement('div');
      target.id = 'anchor-target';
      window.document.body.append(target);

      const App = () => (
        <div>
          <Teleport to="#anchor-target">
            <span>Anchored content</span>
          </Teleport>
        </div>
      );
      const result = renderer.render(App) as HTMLElement;
      window.document.body.append(result);

      const anchor = result.childNodes[0];
      expect(anchor.nodeType).toBe(window.Node.COMMENT_NODE);

      renderer.observer?.flush();

      const teleported = target.querySelector('retend-teleport');
      assert(teleported);
      expect(Reflect.get(anchor, '__retendTeleportedContainer')).toBe(
        teleported
      );
    });
  });
});

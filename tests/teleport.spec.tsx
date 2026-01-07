import { Cell, getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { Teleport } from 'retend-web';
import { assert, describe, expect, it, vi } from 'vitest';
import { browserSetup, getTextContent, timeout } from './setup.tsx';

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

      const result = (
        <div>
          <Teleport to="#teleport-target">
            <div>Teleported content</div>
          </Teleport>
        </div>
      ) as HTMLElement;

      window.document.body.append(result);

      // The anchor should be in the original location
      expect(result.tagName).toBe('DIV');

      await timeout();

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

      const result = (
        <div>
          <Teleport to="section">
            <div>Teleported to section</div>
          </Teleport>
        </div>
      ) as HTMLElement;

      window.document.body.append(result);

      await timeout();

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

      const result = (
        <div>
          <Teleport to="#dynamic-target">
            <div>{content}</div>
          </Teleport>
        </div>
      ) as HTMLElement;

      window.document.body.append(result);

      await timeout();

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

      const result = (
        <div>
          <Teleport to="#nonexistent-target">
            <div>Content</div>
          </Teleport>
        </div>
      ) as HTMLElement;

      window.document.body.append(result);

      await timeout();

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

      const result = (
        <div>
          <Teleport to="#multi-target">
            <div>First teleport</div>
          </Teleport>
          <Teleport to="#multi-target">
            <div>Second teleport</div>
          </Teleport>
        </div>
      ) as HTMLElement;

      window.document.body.append(result);

      await timeout();

      // Both teleports should be in the target
      const teleports = target.querySelectorAll('retend-teleport');
      expect(teleports.length).toBe(2);
      expect(getTextContent(teleports[0])).toBe('First teleport');
      expect(getTextContent(teleports[1])).toBe('Second teleport');
    });
  });
});

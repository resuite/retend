import type { VElement, VNode } from 'retend-server/v-dom';
import type { DOMRenderer } from 'retend-web';

import { Cell, getActiveRenderer } from 'retend';
import { ShadowRoot } from 'retend-web';
import { assert, describe, expect, it } from 'vitest';

import { browserSetup, getTextContent, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should create a shadow root with default mode "open"', () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const App = () => (
      <div>
        <ShadowRoot>
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    );
    const result = renderer.render(App) as HTMLElement & VElement;

    expect(result instanceof window.HTMLElement).toBe(true);
    const shadowRoot = result.shadowRoot;
    assert(shadowRoot);
    expect(shadowRoot?.mode).toBe('open');
    expect(getTextContent(shadowRoot)).toBe('Shadow content');
  });

  it('should encapsulate styles within shadow root', () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const App = () => (
      <div>
        <div class="test">Light DOM</div>
        <ShadowRoot>
          <style>{'.test { color: red; }'}</style>
          <div class="test">Shadow DOM</div>
        </ShadowRoot>
      </div>
    );
    const result = renderer.render(App) as HTMLElement & VElement;

    window.document.body.append(result as Node & VNode);

    expect(result.querySelector('style')).toBeNull();
  });

  it('should handle Cell children updates', () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const content = Cell.source('Initial');
    const App = () => (
      <div>
        <ShadowRoot>
          <div>{content}</div>
        </ShadowRoot>
      </div>
    );
    const result = renderer.render(App) as HTMLElement & VElement;

    window.document.body.append(result as Node & VNode);
    const shadowRoot = result.shadowRoot;

    assert(shadowRoot);
    expect(getTextContent(shadowRoot)).toBe('Initial');

    content.set('Updated');
    expect(getTextContent(shadowRoot)).toBe('Updated');
  });

  it('should handle nested shadow roots', () => {
    const renderer = getActiveRenderer();
    const App = () => (
      <div>
        <ShadowRoot>
          <div>
            Outer Shadow
            <ShadowRoot>
              <div>Inner Shadow</div>
            </ShadowRoot>
          </div>
        </ShadowRoot>
      </div>
    );
    const result = renderer.render(App) as HTMLElement & VElement;

    const outerShadow = result.shadowRoot;
    const innerShadow = outerShadow?.querySelector('div')?.shadowRoot;

    assert(outerShadow);
    assert(innerShadow);
    expect(getTextContent(outerShadow)).toContain('Outer Shadow');
    expect(getTextContent(innerShadow)).toBe('Inner Shadow');
  });

  it('should render fragment children in shadow roots', () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const App = () => (
      <div>
        <ShadowRoot>
          <>
            <span id="fragment-first">First</span>
            <span id="fragment-second">Second</span>
          </>
        </ShadowRoot>
      </div>
    );
    const result = renderer.render(App) as HTMLElement & VElement;
    const shadowRoot = result.shadowRoot;

    assert(shadowRoot);
    const first = shadowRoot.querySelector('#fragment-first');
    const second = shadowRoot.querySelector('#fragment-second');

    assert(first);
    assert(second);
    expect(getTextContent(first)).toBe('First');
    expect(getTextContent(second)).toBe('Second');
  });
};

describe('ShadowRoot', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    // Event listeners are not supported in the VDom.
    it('should maintain event listeners in shadow DOM', () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const clicked = Cell.source(false);
      const handleClick = () => {
        clicked.set(true);
      };

      const App = () => (
        <div>
          <ShadowRoot>
            <button type="button" onClick={handleClick}>
              Click me
            </button>
          </ShadowRoot>
        </div>
      );
      const result = renderer.render(App) as HTMLElement & VElement;

      window.document.body.append(result as Node & VNode);
      const button = result.shadowRoot?.querySelector('button');

      expect(clicked.get()).toBe(false);
      button?.click();
      expect(clicked.get()).toBe(true);
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

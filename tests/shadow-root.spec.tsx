import { describe, it, expect } from 'vitest';
import { Cell } from '@adbl/cells';
import { getGlobalContext } from '@adbl/unfinished';
import { browserSetup, getTextContent, vDomSetup } from './setup.ts';
import { ShadowRoot } from '@adbl/unfinished/shadowroot';
import type { VNode, VElement } from '@adbl/unfinished/v-dom';
import assert from 'node:assert';

const runTests = () => {
  it('should create a shadow root with default mode "open"', () => {
    const { window } = getGlobalContext();
    const result = (
      <div>
        <ShadowRoot>
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    ) as HTMLElement & VElement;

    expect(result instanceof window.HTMLElement).toBe(true);
    const shadowRoot = result.shadowRoot;
    assert(shadowRoot);
    expect(shadowRoot?.mode).toBe('open');
    expect(getTextContent(shadowRoot)).toBe('Shadow content');
  });

  it('should create a closed shadow root', () => {
    const { window } = getGlobalContext();
    const result = (
      <div>
        <ShadowRoot mode="closed">
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    ) as HTMLElement & VElement;

    expect(result instanceof window.HTMLElement).toBe(true);
    // Cannot access closed shadowRoot directly
    expect(result.shadowRoot).toBeNull();
  });

  it('should encapsulate styles within shadow root', () => {
    const { window } = getGlobalContext();
    const result = (
      <div>
        <div class="test">Light DOM</div>
        <ShadowRoot>
          <style>{'.test { color: red; }'}</style>
          <div class="test">Shadow DOM</div>
        </ShadowRoot>
      </div>
    ) as HTMLElement & VElement;

    window.document.body.append(result as Node & VNode);

    expect(result.querySelector('style')).toBeNull();
  });

  it('should handle Cell children updates', () => {
    const { window } = getGlobalContext();
    const content = Cell.source('Initial');
    const result = (
      <div>
        <ShadowRoot>
          <div>{content}</div>
        </ShadowRoot>
      </div>
    ) as HTMLElement & VElement;

    window.document.body.append(result as Node & VNode);
    const shadowRoot = result.shadowRoot;

    assert(shadowRoot);
    expect(getTextContent(shadowRoot)).toBe('Initial');

    content.value = 'Updated';
    expect(getTextContent(shadowRoot)).toBe('Updated');
  });

  it('should handle nested shadow roots', () => {
    const { window } = getGlobalContext();
    const result = (
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
    ) as HTMLElement & VElement;

    const outerShadow = result.shadowRoot;
    const innerShadow = outerShadow?.querySelector('div')?.shadowRoot;

    assert(outerShadow);
    assert(innerShadow);
    expect(getTextContent(outerShadow)).toContain('Outer Shadow');
    expect(getTextContent(innerShadow)).toBe('Inner Shadow');
  });
};

describe('ShadowRoot', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    // Event listeners are not supported in the VDom.
    it('should maintain event listeners in shadow DOM', () => {
      const { window } = getGlobalContext();
      const clicked = Cell.source(false);
      const handleClick = () => {
        clicked.value = true;
      };

      const result = (
        <div>
          <ShadowRoot>
            <button type="button" onClick={handleClick}>
              Click me
            </button>
          </ShadowRoot>
        </div>
      ) as HTMLElement & VElement;

      window.document.body.append(result as Node & VNode);
      const button = result.shadowRoot?.querySelector('button');

      expect(clicked.value).toBe(false);
      button?.click();
      expect(clicked.value).toBe(true);
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

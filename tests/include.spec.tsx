import { describe, it, expect } from 'vitest';
import { Include } from 'retent/include';
import { getGlobalContext, type AsNode } from 'retent/context';
import { browserSetup, vDomSetup, getTextContent } from './setup.ts';
import { Cell, type JsxElement } from 'retent';
import type { VElement } from 'retent/v-dom';

const runTests = () => {
  it('should include an external element using selector', () => {
    const { window } = getGlobalContext();
    const target = (<div id="external">External content</div>) as AsNode;
    window.document.body.append(target);

    const included = (<Include from="#external" />) as Element | VElement;
    expect(getTextContent(included)).toBe('External content');
    expect(included?.getAttribute('id')).toBe('external');
  });

  it('should include an external element using Cell reference', () => {
    const targetRef = Cell.source<JsxElement | null>(null);
    const target = (<div>Referenced content</div>) as JsxElement;
    targetRef.value = target;

    const included = (<Include from={targetRef} />) as Element | VElement;
    expect(getTextContent(included)).toBe('Referenced content');
  });

  it('should modify attributes of included element', () => {
    const { window } = getGlobalContext();
    const target = (<div id="external" />) as AsNode;
    window.document.body.append(target);

    const included = (
      <Include from="#external" class="modified" data-test="true" />
    ) as Element | VElement;
    expect(included?.getAttribute('class')).toBe('modified');
    expect(included?.getAttribute('data-test')).toBe('true');
    expect(included?.getAttribute('id')).toBe('external');
  });

  it('should include children of included element', () => {
    const { window } = getGlobalContext();
    const target = (
      <div id="external">
        <p>Original content</p>
      </div>
    ) as AsNode;
    window.document.body.append(target);

    const included = (
      <Include from="#external">
        <span>New content</span>
      </Include>
    ) as Element | VElement;

    expect(included?.childNodes.length).toBe(2);

    const firstChild = included?.childNodes[0] as Element;
    expect(firstChild?.tagName.toLowerCase()).toBe('p');
    expect(getTextContent(firstChild)).toBe('Original content');

    const secondChild = included?.childNodes[1] as Element;
    expect(secondChild?.tagName.toLowerCase()).toBe('span');
    expect(getTextContent(secondChild)).toBe('New content');
  });
};

describe('Include Component', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    // Event listeners are not supported in the VDom.
    it('should handle event listeners on included element', () => {
      const { window } = getGlobalContext();
      const target = (<button type="button" id="external-button" />) as AsNode;
      window.document.body.append(target);

      let clicked = false;
      const included = (
        <Include
          from="#external-button"
          onClick={() => {
            clicked = true;
          }}
        />
      ) as Element | VElement;

      included?.dispatchEvent(new Event('click'));
      expect(clicked).toBe(true);
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

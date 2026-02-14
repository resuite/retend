import { Cell, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';
import { browserSetup, vDomSetup } from './setup.tsx';

const runTests = () => {
  const renderElement = (node: unknown) =>
    getActiveRenderer().render(node) as unknown as Element;

  it('should set an attribute on an element', () => {
    const element = renderElement(<div class="card">Hello, world!</div>);
    expect(element.getAttribute('class')).toBe('card');
  });

  it('should set a reactive attribute on an element', () => {
    const id = Cell.source('id');
    const element = renderElement(<div id={id}>Hello, world!</div>);
    expect(element.getAttribute('id')).toBe('id');
    id.set('another-id');
    expect(element.getAttribute('id')).toBe('another-id');
  });
};

describe('Attributes', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

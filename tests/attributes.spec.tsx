import { Cell } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, render, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should set an attribute on an element', () => {
    const element = render(<div class="card">Hello, world!</div>);
    expect(element.getAttribute('class')).toBe('card');
  });

  it('should set a reactive attribute on an element', () => {
    const id = Cell.source('id');
    const element = render(<div id={id}>Hello, world!</div>);
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

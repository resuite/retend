import { describe, it, expect } from 'vitest';
import { Cell } from 'retend';
import { browserSetup, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should set an attribute on an element', () => {
    const element = <div class="card">Hello, world!</div>;
    expect((element as unknown as Element).getAttribute('class')).toBe('card');
  });

  it('should set a reactive attribute on an element', () => {
    const id = Cell.source('id');
    const element = <div id={id}>Hello, world!</div>;
    expect((element as unknown as Element).getAttribute('id')).toBe('id');
    id.set('another-id');
    expect((element as unknown as Element).getAttribute('id')).toBe(
      'another-id'
    );
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

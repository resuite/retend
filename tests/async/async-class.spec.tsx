import { Cell } from 'retend';
import { describe, expect, it } from 'vitest';
import { browserSetup, render, timeout, vDomSetup } from '../setup.tsx';

const runTests = () => {
  it('should handle async class string', async () => {
    const className = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-container';
    });

    const element = render(<div class={className} />);

    const cls = element.getAttribute('class');
    expect(cls === null || cls === '').toBe(true);

    await timeout(20);

    expect(element.getAttribute('class')).toBe('async-container');
  });

  it('should handle async class update', async () => {
    const trigger = Cell.source('first');
    const className = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return val;
    });

    const element = render(<div class={className} />);

    await timeout(20);
    expect(element.getAttribute('class')).toBe('first');

    trigger.set('second');

    await timeout(20);
    expect(element.getAttribute('class')).toBe('second');
  });

  it('should handle async class in array', async () => {
    const asyncPart = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-part';
    });

    const element = render(<div class={['static', asyncPart]} />);

    expect(element.getAttribute('class')).toBe('static');

    await timeout(20);

    expect(element.getAttribute('class')).toBe('static async-part');
  });

  it('should handle async class object', async () => {
    const enable = Cell.source(false);
    const asyncObj = Cell.derivedAsync(async (get) => {
      const isEnabled = get(enable);
      await timeout(10);
      return { 'async-active': isEnabled };
    });

    const element = render(<div class={asyncObj} />);

    await timeout(20);
    const cls = element.getAttribute('class');
    expect(cls === null || cls === '').toBe(true);

    enable.set(true);
    await timeout(20);

    expect(element.getAttribute('class')).toBe('async-active');
  });

  it('should handle mixed static and async derived classes', async () => {
    const asyncClass = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-loaded';
    });

    const element = render(
      <div class={['static', { dynamic: true }, asyncClass]} />
    );

    expect(element.getAttribute('class')).toBe('static dynamic');

    await timeout(20);

    expect(element.getAttribute('class')).toBe('static dynamic async-loaded');
  });
};

describe('Async Class Attribute', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

import { describe, it, expect } from 'vitest';
import { Cell } from 'retend';
import { browserSetup, vDomSetup, timeout } from './setup.tsx';

const runTests = () => {
  it('should handle async id attribute', async () => {
    const idCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-id';
    });

    const element = <div id={idCell} />;

    // Initially should be null or default
    expect((element as unknown as Element).getAttribute('id')).toBeNull();

    await timeout(20);

    expect((element as unknown as Element).getAttribute('id')).toBe('async-id');
  });

  it('should handle async attribute update', async () => {
    const titleTrigger = Cell.source('initial title');
    const titleCell = Cell.derivedAsync(async (get) => {
      const val = get(titleTrigger);
      await timeout(10);
      return val;
    });

    const element = <div title={titleCell} />;

    await timeout(20);
    expect((element as unknown as Element).getAttribute('title')).toBe(
      'initial title'
    );

    titleTrigger.set('updated title');

    await timeout(20);
    expect((element as unknown as Element).getAttribute('title')).toBe(
      'updated title'
    );
  });

  it('should handle async data attributes', async () => {
    const dataCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'data-value';
    });

    const element = <div data-test={dataCell} />;

    expect(
      (element as unknown as Element).getAttribute('data-test')
    ).toBeNull();

    await timeout(20);

    expect((element as unknown as Element).getAttribute('data-test')).toBe(
      'data-value'
    );
  });

  it('should handle multiple async attributes', async () => {
    const idCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'multi-id';
    });
    const titleCell = Cell.derivedAsync(async () => {
      await timeout(20);
      return 'multi-title';
    });

    const element = <div id={idCell} title={titleCell} />;

    await timeout(15);
    expect((element as unknown as Element).getAttribute('id')).toBe('multi-id');
    expect((element as unknown as Element).getAttribute('title')).toBeNull();

    await timeout(15);
    expect((element as unknown as Element).getAttribute('title')).toBe(
      'multi-title'
    );
  });

  it('should handle async href on anchor', async () => {
    const urlCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'https://example.com';
    });

    const element = <a href={urlCell}>Link</a>;

    await timeout(20);

    expect((element as unknown as HTMLAnchorElement).getAttribute('href')).toBe(
      'https://example.com'
    );
  });
};

describe('Async Attributes', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

import { Await, Cell, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';
import { browserSetup, getTextContent, timeout, vDomSetup } from '../setup.tsx';

const runTests = () => {
  it('should handle async id attribute', async () => {
    const renderer = getActiveRenderer();
    const idCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-id';
    });

    const element = renderer.render(<div id={idCell} />) as unknown as Element;

    // Initially should be null or default
    expect(element.getAttribute('id')).toBeNull();

    await timeout(20);

    expect(element.getAttribute('id')).toBe('async-id');
  });

  it('should handle async attribute update', async () => {
    const renderer = getActiveRenderer();
    const titleTrigger = Cell.source('initial title');
    const titleCell = Cell.derivedAsync(async (get) => {
      const val = get(titleTrigger);
      await timeout(10);
      return val;
    });

    const element = renderer.render(
      <div title={titleCell} />
    ) as unknown as Element;

    await timeout(20);
    expect(element.getAttribute('title')).toBe('initial title');

    titleTrigger.set('updated title');

    await timeout(20);
    expect(element.getAttribute('title')).toBe('updated title');
  });

  it('should handle async data attributes', async () => {
    const renderer = getActiveRenderer();
    const dataCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'data-value';
    });

    const element = renderer.render(
      <div data-test={dataCell} />
    ) as unknown as Element;

    expect(element.getAttribute('data-test')).toBeNull();

    await timeout(20);

    expect(element.getAttribute('data-test')).toBe('data-value');
  });

  it('should handle multiple async attributes', async () => {
    const renderer = getActiveRenderer();
    const idCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'multi-id';
    });
    const titleCell = Cell.derivedAsync(async () => {
      await timeout(20);
      return 'multi-title';
    });

    const element = renderer.render(
      <div id={idCell} title={titleCell} />
    ) as unknown as Element;

    await timeout(15);
    expect(element.getAttribute('id')).toBe('multi-id');
    expect(element.getAttribute('title')).toBeNull();

    await timeout(15);
    expect(element.getAttribute('title')).toBe('multi-title');
  });

  it('should handle async href on anchor', async () => {
    const renderer = getActiveRenderer();
    const urlCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'https://example.com';
    });

    const element = renderer.render(
      <a href={urlCell}>Link</a>
    ) as unknown as HTMLAnchorElement;

    await timeout(20);

    expect(element.getAttribute('href')).toBe('https://example.com');
  });

  it('should suspend async attributes within an Await boundary', async () => {
    const renderer = getActiveRenderer();
    const idCell = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'async-id';
    });

    const App = () => (
      <div id="root">
        <Await fallback={<span>Loading</span>}>
          <div id={idCell}>Ready</div>
        </Await>
      </div>
    );

    const result = renderer.render(App) as unknown as Element;

    expect(getTextContent(result)).toBe('Loading');

    await timeout(20);

    const target = result.querySelector('#async-id');
    expect(target?.getAttribute('id')).toBe('async-id');
    expect(getTextContent(result)).toBe('Ready');
  });
};

describe('Async Attributes', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    it('should suspend async style attributes within an Await boundary', async () => {
      const renderer = getActiveRenderer();
      const color = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'red';
      });

      const App = () => (
        <div id="root">
          <Await fallback={<span>Loading</span>}>
            <div id="styled" style={{ color }}>
              Ready
            </div>
          </Await>
        </div>
      );

      const result = renderer.render(App) as unknown as Element;

      expect(getTextContent(result)).toBe('Loading');

      await timeout(20);

      const styled = result.querySelector('#styled');
      expect(styled?.getAttribute('style')).toContain('color: red');
      expect(getTextContent(result)).toBe('Ready');
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

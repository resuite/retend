import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Cell } from '@adbl/cells';
import {
  If,
  Modes, // @ts-types="../packages/unfinished/dist/library/index.js"
  resetGlobalContext,
  setGlobalContext,
} from '@adbl/unfinished';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

describe('If function', () => {
  beforeAll(() => {
    GlobalRegistrator.register();
    setGlobalContext({
      window,
      consistentValues: new Map(),
      mode: Modes.Interactive,
      teleportIdCounter: { value: 0 },
    });
  });

  afterAll(() => {
    GlobalRegistrator.unregister();
    resetGlobalContext();
  });

  it('should render truthy branch when condition is true', () => {
    const result = If(true, () => <div>True</div>);
    expect(result instanceof HTMLDivElement).toBe(true);

    expect((result as HTMLDivElement).textContent).toBe('True');
  });

  it('should render falsy branch when condition is false', () => {
    const result = If(
      false,
      () => <div>True</div>,
      () => <div>False</div>
    ) as HTMLDivElement;
    expect(result instanceof HTMLDivElement).toBe(true);
    expect(result.textContent).toBe('False');
  });

  it('should render nothing when condition is false and no falsy branch provided', () => {
    const result = If(false, () => <div>True</div>);
    expect(result).toBeUndefined();
  });

  it('should work with Cell conditions', () => {
    const condition = Cell.source(true);
    const result = (
      <div id="test-node">
        {If(
          condition,
          () => (
            <div>True</div>
          ),
          () => (
            <div>False</div>
          )
        )}
      </div>
    ) as HTMLElement;

    document.body.appendChild(result);

    expect(result instanceof HTMLDivElement).toBe(true);
    expect(result.firstChild instanceof Comment).toBe(true);
    expect(result.childNodes[1].textContent).toBe('True');
    expect(result.childNodes[2] instanceof Comment).toBe(true);

    condition.value = false;
    // // The DOM should automatically update due to cell reactivity
    expect(result.childNodes[1].textContent).toBe('False');
  });

  it('should accept an object with true/false branches', () => {
    const result = If(true, {
      true: () => <div>True</div>,
      false: () => <div>False</div>,
    }) as HTMLElement;
    expect(result instanceof HTMLDivElement).toBe(true);
    expect((result as HTMLElement)?.textContent).toBe('True');
  });

  it('should handle nested If statements', () => {
    const outer = Cell.source(true);
    const inner = Cell.source(false);

    const result = (
      <div>
        {If(outer, () =>
          If(
            inner,
            () => <div>Both True</div>,
            () => <div>Outer True, Inner False</div>
          )
        )}
      </div>
    ) as HTMLElement;

    expect(result instanceof HTMLDivElement).toBe(true);
    expect(result.textContent).toBe('Outer True, Inner False');

    inner.value = true;
    expect(result.textContent).toBe('Both True');
  });

  it('should handle falsy values properly', () => {
    const values = [false, 0, '', null, undefined];
    for (const value of values) {
      const result = If(
        value as boolean | null | undefined,
        () => <div>True</div>,
        () => <div>False</div>
      ) as HTMLElement | null;
      expect(result?.textContent).toBe('False');
    }
  });

  it('should handle truthy values properly', () => {
    const values = [true, 1, 'hello', [], {}];
    for (const value of values) {
      const result = (
        <div>
          {If(
            value,
            () => (
              <div>True</div>
            ),
            () => (
              <div>False</div>
            )
          )}
        </div>
      ) as HTMLElement;
      expect(result.textContent).toBe('True');
    }
  });
});

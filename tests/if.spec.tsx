import { describe, it, expect } from 'vitest';
import { Cell } from '@adbl/cells';
import { If, type NodeLike, getGlobalContext } from '@adbl/unfinished';
import { browserSetup, getTextContent, vDomSetup } from './setup.ts';
import type { VNode } from '@adbl/unfinished/v-dom';

const runTests = () => {
  it('should render truthy branch when condition is true', () => {
    const result = If(true, () => <div>True</div>) as NodeLike;
    expect(result.childNodes[0].textContent).toBe('True');
  });

  it('should render falsy branch when condition is false', () => {
    const result = If(
      false,
      () => <div>True</div>,
      () => <div>False</div>
    ) as NodeLike;
    expect(getTextContent(result)).toBe('False');
  });

  it('should render nothing when condition is false and no falsy branch provided', () => {
    const result = If(false, () => <div>True</div>);
    expect(result).toBeUndefined();
  });

  it('should work with Cell conditions', () => {
    const { window } = getGlobalContext();
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
    ) as NodeLike;

    window.document.body.append(result as Node & VNode);

    expect(result instanceof window.HTMLElement).toBe(true);
    expect(result.childNodes[0] instanceof window.Comment).toBe(true);
    expect(getTextContent(result)).toBe('True');
    expect(result.childNodes[2] instanceof window.Comment).toBe(true);

    condition.value = false;
    // // The DOM should automatically update due to cell reactivity
    expect(getTextContent(result)).toBe('False');
  });

  it('should accept an object with true/false branches', () => {
    const { window } = getGlobalContext();
    const result = If(true, {
      true: () => <div>True</div>,
      false: () => <div>False</div>,
    }) as NodeLike;
    expect(result instanceof window.HTMLElement).toBe(true);
    expect(result.childNodes[0].textContent).toBe('True');
  });

  it('should handle nested If statements', () => {
    const { window } = getGlobalContext();
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

    expect(result instanceof window.HTMLElement).toBe(true);
    expect(getTextContent(result)).toBe('Outer True, Inner False');

    inner.value = true;
    expect(getTextContent(result)).toBe('Both True');
  });

  it('should handle falsy values properly', () => {
    const values = [false, 0, '', null, undefined];
    for (const value of values) {
      const result = If(
        value as boolean | null | undefined,
        () => <div>True</div>,
        () => <div>False</div>
      ) as NodeLike;
      expect(getTextContent(result)).toBe('False');
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
      ) as NodeLike;
      expect(getTextContent(result)).toBe('True');
    }
  });
};

describe('If', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

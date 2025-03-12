import { describe, it, expect } from 'vitest';
import { Cell } from '@adbl/cells';
import { Switch, If, type NodeLike, getGlobalContext } from '@adbl/unfinished';
import { browserSetup, getTextContent, vDomSetup } from './setup.ts';
import type { VElement, VNode } from '@adbl/unfinished/v-dom';

const runTests = () => {
  it('should render matching case', () => {
    const result = Switch('A' as 'A' | 'B', {
      A: () => <div>Case A</div>,
      B: () => <div>Case B</div>,
    }) as NodeLike;

    expect(getTextContent(result)).toBe('Case A');
  });

  it('should handle Cell values', () => {
    const { window } = getGlobalContext();
    const value = Cell.source('A');
    const result = (
      <div id="test-node">
        {Switch(value, {
          A: () => <div>Case A</div>,
          B: () => <div>Case B</div>,
        })}
      </div>
    ) as NodeLike;

    window.document.body.append(result as Node & VNode);
    expect(getTextContent(result)).toBe('Case A');

    value.value = 'B';
    expect(getTextContent(result)).toBe('Case B');
  });

  it('should use default case when no match found', () => {
    const result = Switch(
      'C' as 'A' | 'B' | 'C',
      {
        A: () => <div>Case A</div>,
        B: () => <div>Case B</div>,
      },
      (value) => <div>Default: {value}</div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Default: C');
  });

  it('should return undefined when no match and no default', () => {
    const result = Switch('C' as 'A' | 'B', {
      A: () => <div>Case A</div>,
      B: () => <div>Case B</div>,
    });

    expect(result).toBeUndefined();
  });

  it('should handle number cases', () => {
    const value = Cell.source(1);
    const result = (
      <div>
        {Switch(value, {
          1: () => <div>One</div>,
          2: () => <div>Two</div>,
        })}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('One');

    value.value = 2;
    expect(getTextContent(result)).toBe('Two');
  });

  it('should handle nested switches', () => {
    const outer = Cell.source('A');
    const inner = Cell.source(1);

    const result = (
      <div>
        {Switch(outer, {
          A: () =>
            Switch(inner, {
              1: () => <div>A1</div>,
              2: () => <div>A2</div>,
            }),
          B: () => <div>B</div>,
        })}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('A1');

    inner.value = 2;
    expect(getTextContent(result)).toBe('A2');

    outer.value = 'B';
    expect(getTextContent(result)).toBe('B');
  });

  it('should handle null and undefined values', () => {
    const result = Switch(
      null,
      {
        A: () => <div>Case A</div>,
      },
      () => <div>Default Case</div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Default Case');

    const result2 = Switch(
      undefined,
      {
        A: () => <div>Case A</div>,
      },
      () => <div>Default Case</div>
    ) as NodeLike;

    expect(getTextContent(result2)).toBe('Default Case');
  });

  it('should handle complex case values', () => {
    const status = Cell.source('loading');
    const error = Cell.source<Error | null>(null);

    const result = (
      <div>
        {Switch(status, {
          loading: () => <div>Loading...</div>,
          error: () =>
            If(error, (err) => (
              <div>Error: {err?.message ?? 'Unknown error'}</div>
            )),
          success: () => <div>Success!</div>,
        })}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Loading...');

    status.value = 'error';
    error.value = new Error('Test error');
    expect(getTextContent(result)).toBe('Error: Test error');

    status.value = 'success';
    expect(getTextContent(result)).toBe('Success!');
  });

  it('should not maintain element identity across updates', () => {
    const { window } = getGlobalContext();
    const value = Cell.source('A');
    const result = (
      <div>
        {Switch(value, {
          A: () => <span>Case A</span>,
          B: () => <span>Case B</span>,
        })}
      </div>
    ) as HTMLElement & VElement;

    window.document.body.append(result as Node & VNode);
    const firstSpan = result.querySelector('span');

    value.value = 'B';
    const secondSpan = result.querySelector('span');

    expect(firstSpan).not.toBe(secondSpan);
  });
};

describe('Switch', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

import { describe, it, expect } from 'vitest';
import { Cell } from 'retent';
import { For } from 'retent';
import { type NodeLike, getGlobalContext } from 'retent/context';
import { browserSetup, getTextContent, vDomSetup } from './setup.ts';
import type { VNode, VElement } from 'retent/v-dom';

const runTests = () => {
  it('should render a list of elements', () => {
    const items = ['A', 'B', 'C'];
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('ABC');
  });

  it('should handle empty arrays', () => {
    const items: string[] = [];
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');
  });

  it('should update only when Cell array changes', () => {
    const items = Cell.source(['A', 'B', 'C']);
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('ABC');

    items.value = ['A', 'B', 'C'];
    expect(getTextContent(result)).toBe('ABC');

    items.value = ['D', 'E', 'F'];
    expect(getTextContent(result)).toBe('DEF');
  });

  it('should provide correct indices', () => {
    const items = ['First', 'Second', 'Third'];
    const indices: number[] = [];

    const result = (
      <div>
        {For(items, (item, index) => {
          indices.push(index.value);
          return <span>{item}</span>;
        })}
      </div>
    ) as NodeLike;

    expect(indices).toEqual([0, 1, 2]);
    expect(getTextContent(result)).toBe('FirstSecondThird');
  });

  it('should handle complex objects', () => {
    const items = [
      { id: 1, text: 'First' },
      { id: 2, text: 'Second' },
      { id: 3, text: 'Third' },
    ];

    const result = (
      <div>
        {For(items, (item) => (
          <span>{item.text}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('FirstSecondThird');
  });

  it('should handle nested For loops', () => {
    const matrix = [
      [1, 2],
      [3, 4],
    ];

    const result = (
      <div>
        {For(matrix, (row) => (
          <div>
            {For(row, (cell) => (
              <span>{cell}</span>
            ))}
          </div>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('1234');
  });

  it('should maintain element identity when items are reordered', () => {
    const { window } = getGlobalContext();
    const items = Cell.source([
      { id: 1, text: 'First' },
      { id: 2, text: 'Second' },
    ]);

    const result = (
      <div>
        {For(items, (item) => (
          <span>{item.text}</span>
        ))}
      </div>
    ) as HTMLElement & VElement;

    window.document.body.append(result as unknown as Node & VNode);
    const firstSpans = Array.from(result.querySelectorAll('span'));

    items.value = [...items.value].reverse();
    const secondSpans = Array.from(result.querySelectorAll('span'));

    // The DOM nodes should be the same but reordered

    expect(firstSpans.length).toBe(2);
    expect(secondSpans.length).toBe(2);
    expect(firstSpans[0]).toBe(secondSpans[1]);
    expect(firstSpans[1]).toBe(secondSpans[0]);
  });

  it('should handle dynamic item updates', () => {
    const items = Cell.source([
      { id: 1, text: Cell.source('First') },
      { id: 2, text: Cell.source('Second') },
    ]);

    const result = (
      <div>
        {For(items, (item) => (
          <span>{item.text}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('FirstSecond');

    items.value[0].text.value = 'Updated';
    expect(getTextContent(result)).toBe('UpdatedSecond');
  });

  it('should handle null and undefined values', () => {
    const items = [null, undefined, 'Valid'];
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Valid');
  });
};

describe('For', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

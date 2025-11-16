import { describe, it, expect } from 'vitest';
import { Cell } from 'retend';
import { For } from 'retend';
import { type NodeLike, getGlobalContext } from 'retend/context';
import { browserSetup, getTextContent, vDomSetup } from './setup.ts';
import type { VNode, VElement } from 'retend/v-dom';

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

    items.set(['A', 'B', 'C']);
    expect(getTextContent(result)).toBe('ABC');

    items.set(['D', 'E', 'F']);
    expect(getTextContent(result)).toBe('DEF');
  });

  it('should provide correct indices', () => {
    const items = ['First', 'Second', 'Third'];
    const indices: number[] = [];

    const result = (
      <div>
        {For(items, (item, index) => {
          indices.push(index.get());
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

    items.set([...items.get()].reverse());
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

    items.get()[0].text.set('Updated');
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

  it('should handle null list', () => {
    const result = (
      <div>
        {For(null, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');
  });

  it('should handle undefined list', () => {
    const result = (
      <div>
        {For(undefined, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');
  });

  it('should handle Cell with null value', () => {
    const items = Cell.source(null);
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');
  });

  it('should handle Cell with undefined value', () => {
    const items = Cell.source(undefined);
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');
  });

  it('should handle Cell changing from array to null', () => {
    const items = Cell.source<string[] | null>(['A', 'B']);
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('AB');

    items.set(null);
    expect(getTextContent(result)).toBe('');
  });

  it('should handle Cell changing from null to array', () => {
    const items = Cell.source<string[] | null>(null);
    const result = (
      <div>
        {For(items, (item) => (
          <span>{item}</span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');

    items.set(['C', 'D']);
    expect(getTextContent(result)).toBe('CD');
  });

  it('should use property key for object items', () => {
    const items = Cell.source([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);

    let callbackCount = 0;
    const result = (
      <div>
        {For(
          items,
          (item) => {
            callbackCount++;
            return <span>{item.name}</span>;
          },
          { key: 'id' }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('AliceBobCharlie');
    expect(callbackCount).toBe(3); // Called once for each initial item

    items.set([
      { id: 3, name: 'Charlie' },
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    expect(getTextContent(result)).toBe('CharlieAliceBob');
    expect(callbackCount).toBe(3); // No additional calls - items reused due to same keys
  });

  it('should use function key for object items', () => {
    const items = Cell.source([
      { uuid: 'a1b2-c3d4', name: 'First' },
      { uuid: 'e5f6-g7h8', name: 'Second' },
      { uuid: 'i9j0-k1l2', name: 'Third' },
    ]);

    let callbackCount = 0;
    const result = (
      <div>
        {For(
          items,
          (item) => {
            callbackCount++;
            return <span>{item.name}</span>;
          },
          { key: (item) => item.uuid }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('FirstSecondThird');
    expect(callbackCount).toBe(3); // Called once for each initial item

    items.set([
      { uuid: 'i9j0-k1l2', name: 'Third' },
      { uuid: 'a1b2-c3d4', name: 'First' },
      { uuid: 'e5f6-g7h8', name: 'Second' },
    ]);

    expect(getTextContent(result)).toBe('ThirdFirstSecond');
    expect(callbackCount).toBe(3); // No additional calls - items reused due to same keys
  });

  it('should handle function key returning different types', () => {
    const items = Cell.source([
      { id: 1, category: 'A', value: 'Item1' },
      { id: 2, category: 'B', value: 'Item2' },
      { id: 3, category: 'A', value: 'Item3' },
    ]);

    let callbackCount = 0;
    const result = (
      <div>
        {For(
          items,
          (item) => {
            callbackCount++;
            return <span>{item.value}</span>;
          },
          { key: (item) => `${item.category}-${item.id}` }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Item1Item2Item3');
    expect(callbackCount).toBe(3); // Called once for each initial item

    // Reorder by changing the array order
    items.set([
      { id: 3, category: 'A', value: 'Item3' },
      { id: 1, category: 'A', value: 'Item1' },
      { id: 2, category: 'B', value: 'Item2' },
    ]);

    expect(getTextContent(result)).toBe('Item3Item1Item2');
    expect(callbackCount).toBe(3); // No additional calls - items reused due to same keys
  });

  it('should maintain element identity with function keys when reordering', () => {
    const { window } = getGlobalContext();
    let callbackCount = 0;
    const items = Cell.source([
      { id: 'alpha', text: 'First' },
      { id: 'beta', text: 'Second' },
      { id: 'gamma', text: 'Third' },
    ]);

    const result = (
      <div>
        {For(
          items,
          (item) => {
            callbackCount++;
            return <span data-id={item.id}>{item.text}</span>;
          },
          { key: (item) => item.id }
        )}
      </div>
    ) as HTMLElement & VElement;

    window.document.body.append(result as unknown as Node & VNode);
    expect(callbackCount).toBe(3); // Initial render
    const firstSpans = Array.from(result.querySelectorAll('span'));

    items.set([
      { id: 'gamma', text: 'Third' },
      { id: 'beta', text: 'Second' },
      { id: 'alpha', text: 'First' },
    ]);
    expect(callbackCount).toBe(3);

    const secondSpans = Array.from(result.querySelectorAll('span'));

    expect(firstSpans.length).toBe(3);
    expect(secondSpans.length).toBe(3);
    expect(firstSpans[0]).toBe(secondSpans[2]); // alpha moved to end
    expect(firstSpans[1]).toBe(secondSpans[1]); // beta stayed in middle
    expect(firstSpans[2]).toBe(secondSpans[0]); // gamma moved to start
  });

  it('should handle function key with primitive items', () => {
    const items = Cell.source(['apple', 'banana', 'cherry']);

    const result = (
      <div>
        {For(
          items,
          (item, index) => (
            <span>{item}</span>
          ),
          { key: (item) => item.toUpperCase() }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('applebananacherry');

    items.set(['APPLE', 'banana', 'cherry', 'date']);

    expect(getTextContent(result)).toBe('APPLEbananacherrydate');
  });

  it('should handle function key that returns null/undefined', () => {
    const items = Cell.source([
      { id: 1, name: 'Item1' },
      { id: null, name: 'Item2' },
      { id: undefined, name: 'Item3' },
    ]);

    const result = (
      <div>
        {For(
          items,
          (item) => (
            <span>{item.name}</span>
          ),
          { key: (item) => item.id ?? `fallback-${item.name}` }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('Item1Item2Item3');
  });

  it('should use auto keys when no key option is provided', () => {
    const items = Cell.source([{ name: 'First' }, { name: 'Second' }]);

    let callbackCount = 0;
    const result = (
      <div>
        {For(items, (item) => {
          callbackCount++;
          return <span>{item.name}</span>;
        })}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('FirstSecond');
    expect(callbackCount).toBe(2); // Called once for each initial item

    // Replace with new objects having same structure
    items.set([{ name: 'Updated First' }, { name: 'Updated Second' }]);

    expect(getTextContent(result)).toBe('Updated FirstUpdated Second');
    expect(callbackCount).toBe(4); // Called again for new objects (different references)
  });

  it('should call callback for new items with different keys but reuse existing ones', () => {
    const items = Cell.source([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    let callbackCount = 0;
    const result = (
      <div>
        {For(
          items,
          (item) => {
            callbackCount++;
            return <span>{item.name}</span>;
          },
          { key: 'id' }
        )}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('AliceBob');
    expect(callbackCount).toBe(2); // Called once for each initial item

    // Add new item and reorder existing ones
    items.set([
      { id: 3, name: 'Charlie' }, // New item - should trigger callback
      { id: 1, name: 'Alice' }, // Existing item - should reuse
      { id: 2, name: 'Bob' }, // Existing item - should reuse
    ]);

    expect(getTextContent(result)).toBe('CharlieAliceBob');
    expect(callbackCount).toBe(3); // Only called once for the new item
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

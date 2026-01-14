import { describe, it, expect } from 'vitest';
import { Cell, If, getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import type { VNode } from 'retend-server/v-dom';
import {
  browserSetup,
  getTextContent,
  vDomSetup,
  timeout,
  type NodeLike,
} from './setup.tsx';

const runTests = () => {
  it('should render async truthy value after resolution', async () => {
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const result = (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    ) as NodeLike;

    // Initially empty while pending
    expect(getTextContent(result)).toBe('');

    await timeout(20);

    expect(getTextContent(result)).toBe('True');
  });

  it('should render async falsy value after resolution', async () => {
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return false;
    });

    const result = (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    ) as NodeLike;

    await timeout(20);

    expect(getTextContent(result)).toBe('False');
  });

  it('should update when async condition changes', async () => {
    const trigger = Cell.source(true);
    const asyncCondition = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return val;
    });

    const result = (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    ) as NodeLike;

    await timeout(20);
    expect(getTextContent(result)).toBe('True');

    trigger.set(false);

    await timeout(20);
    expect(getTextContent(result)).toBe('False');
  });

  it('should work with object syntax for branches', async () => {
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const result = (
      <div>
        {If(asyncCondition, {
          true: () => <span>Yes</span>,
          false: () => <span>No</span>,
        })}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');

    await timeout(20);

    expect(getTextContent(result)).toBe('Yes');
  });

  it('should handle async condition with value passed to callback', async () => {
    const asyncData = Cell.derivedAsync(async () => {
      await timeout(10);
      return { name: 'Alice', age: 30 };
    });

    const result = (
      <div>
        {If(asyncData, (data) => (
          <span>
            {data.name} is {data.age}
          </span>
        ))}
      </div>
    ) as NodeLike;

    expect(getTextContent(result)).toBe('');

    await timeout(20);

    expect(getTextContent(result)).toBe('Alice is 30');
  });

  it('should handle async null value', async () => {
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return null;
    });

    const result = (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>Has Value</span>
          ),
          () => (
            <span>No Value</span>
          )
        )}
      </div>
    ) as NodeLike;

    await timeout(20);

    expect(getTextContent(result)).toBe('No Value');
  });

  it('should handle nested async If statements', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const outer = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const inner = Cell.derivedAsync(async () => {
      await timeout(15);
      return true;
    });

    const result = (
      <div>
        {If(outer, () =>
          If(
            inner,
            () => <span>Both True</span>,
            () => <span>Outer True, Inner False</span>
          )
        )}
      </div>
    ) as NodeLike;

    window.document.body.append(result as Node & VNode);

    expect(getTextContent(result)).toBe('');

    await timeout(25);

    expect(getTextContent(result)).toBe('Both True');
  });
};

describe('Async If', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

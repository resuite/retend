import { describe, it, expect } from 'vitest';
import { Cell, getActiveRenderer } from 'retend';
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
  it('should render async text content after resolution', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const asyncText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Hello Async';
    });

    const result = (<div>{asyncText}</div>) as NodeLike;

    window.document.body.append(result as Node & VNode);

    // Wait for resolution
    await timeout(20);

    expect(getTextContent(result)).toBe('Hello Async');
  });

  it('should update async text when dependency changes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const trigger = Cell.source('First');
    const asyncText = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return `Value: ${val}`;
    });

    const result = (<div>{asyncText}</div>) as NodeLike;

    window.document.body.append(result as Node & VNode);

    await timeout(20);
    expect(getTextContent(result)).toBe('Value: First');

    trigger.set('Second');

    await timeout(20);
    expect(getTextContent(result)).toBe('Value: Second');
  });

  it('should handle async text mixed with static content', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const asyncName = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Alice';
    });

    const result = (<div>Hello, {asyncName}!</div>) as NodeLike;

    window.document.body.append(result as Node & VNode);

    await timeout(20);

    expect(getTextContent(result)).toBe('Hello, Alice!');
  });

  it('should handle multiple async text nodes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const firstName = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'John';
    });

    const lastName = Cell.derivedAsync(async () => {
      await timeout(15);
      return 'Doe';
    });

    const result = (
      <div>
        {firstName} {lastName}
      </div>
    ) as NodeLike;

    window.document.body.append(result as Node & VNode);

    await timeout(25);

    expect(getTextContent(result)).toBe('John Doe');
  });

  it('should handle async number values', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const asyncNumber = Cell.derivedAsync(async () => {
      await timeout(10);
      return 42;
    });

    const result = (<div>Count: {asyncNumber}</div>) as NodeLike;

    window.document.body.append(result as Node & VNode);

    await timeout(20);

    expect(getTextContent(result)).toBe('Count: 42');
  });
};

describe('Async Text Nodes', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

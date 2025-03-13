import { describe, it, expect, vi } from 'vitest';
import { Cell } from 'retend';
import { getGlobalContext } from 'retend/context';
import { browserSetup } from './setup.ts';
import type { VNode } from 'retend/v-dom';

describe('Event Modifiers', () => {
  // Only run in browser since VDom doesn't support events

  browserSetup();

  it('should handle prevent modifier', () => {
    const { window } = getGlobalContext();
    const prevented = Cell.source(false);
    const form = (
      <form
        onSubmit--prevent={() => {
          prevented.value = true;
        }}
      >
        <button type="submit">Submit</button>
      </form>
    ) as HTMLFormElement & VNode;

    window.document.body.append(form);
    form.querySelector('button')?.click();

    expect(prevented.value).toBe(true);
  });

  it('should handle stop modifier', () => {
    const { window } = getGlobalContext();
    const parentClicked = Cell.source(false);
    const childClicked = Cell.source(false);

    const div = (
      <div
        onClick={() => {
          parentClicked.value = true;
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            parentClicked.value = true;
          }
        }}
      >
        <button
          type="button"
          onClick--stop={() => {
            childClicked.value = true;
          }}
        >
          Click me
        </button>
      </div>
    ) as HTMLDivElement & VNode;

    window.document.body.append(div);
    div.querySelector('button')?.click();

    expect(childClicked.value).toBe(true);
    expect(parentClicked.value).toBe(false);
  });

  it('should handle self modifier', () => {
    const { window } = getGlobalContext();
    const clicked = Cell.source(false);

    const div = (
      <div
        onClick--self={() => {
          clicked.value = true;
        }}
      >
        <button type="button">Click me</button>
      </div>
    ) as HTMLDivElement & VNode;

    window.document.body.append(div);
    div.querySelector('button')?.click();
    expect(clicked.value).toBe(false);

    div.click();
    expect(clicked.value).toBe(true);
  });

  it('should handle once modifier', () => {
    const { window } = getGlobalContext();
    const clickCount = Cell.source(0);

    const button = (
      <button
        type="button"
        onClick--once={() => {
          clickCount.value++;
        }}
      >
        Click me
      </button>
    ) as HTMLButtonElement & VNode;

    window.document.body.append(button);
    button.click();
    button.click();
    button.click();

    expect(clickCount.value).toBe(1);
  });

  it('should handle passive modifier', () => {
    const { window } = getGlobalContext();
    const handler = vi.fn();

    const div = (
      <div
        onScroll--passive={handler}
        style={{ height: '100px', overflow: 'auto' }}
      >
        <div style={{ height: '200px' }}>Scroll content</div>
      </div>
    ) as HTMLDivElement & VNode;

    window.document.body.append(div);

    const event = new Event('scroll', { cancelable: true });
    div.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should handle multiple modifiers', () => {
    const { window } = getGlobalContext();
    const parentClicked = Cell.source(false);
    const childClicked = Cell.source(0);

    const div = (
      <div
        style={{ padding: '10px' }}
        onClick={() => {
          parentClicked.value = true;
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            parentClicked.value = true;
          }
        }}
      >
        <button
          type="button"
          onClick--stop--once={() => {
            childClicked.value++;
          }}
        >
          Click me
        </button>
      </div>
    ) as HTMLDivElement & VNode;

    window.document.body.append(div);
    const button = div.querySelector('button');
    if (!button) throw new Error('Button not found');
    button.click();
    expect(parentClicked.value).toBe(false);

    button.click();
    expect(childClicked.value).toBe(1);
  });

  it('should apply modifiers in correct order', () => {
    const { window } = getGlobalContext();
    const events: string[] = [];

    const form = (
      <form
        onSubmit--prevent--stop={() => {
          events.push('submit');
        }}
      >
        <button type="submit">Submit</button>
      </form>
    ) as HTMLFormElement & VNode;

    window.document.body.append(form);

    const submitEvent = new Event('submit', {
      cancelable: true,
      bubbles: true,
    });
    form.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(submitEvent.cancelBubble).toBe(true);
  });
});

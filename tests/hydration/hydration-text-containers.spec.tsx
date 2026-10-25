import { Cell } from 'retend';
import { ShadowRoot } from 'retend-web';
import { describe, expect, it } from 'vitest';

import { browserSetup } from '../setup.tsx';
import {
  renderHydrationServerHtml,
  setupHydration,
} from './hydration-helpers.tsx';

describe('Hydration text containers', () => {
  browserSetup();

  it('hydrates a textarea with static text next to a reactive cell', async () => {
    const name = Cell.source('world');
    const template = () => <textarea id="greeting">Hello {name}</textarea>;

    const { document } = await setupHydration(template);
    const textarea = document.querySelector('#greeting') as HTMLTextAreaElement;

    expect(textarea.value).toBe('Hello world');

    name.set('there');

    expect(textarea.value).toBe('Hello there');
  });

  it('hydrates a textarea with a single static text child', async () => {
    const template = () => <textarea id="note">original</textarea>;

    const { document } = await setupHydration(template);
    const textarea = document.querySelector('#note') as HTMLTextAreaElement;

    expect(textarea.value).toBe('original');
  });

  it('hydrates a textarea whose only child is an empty cell', async () => {
    const note = Cell.source('');
    const template = () => <textarea id="empty-note">{note}</textarea>;

    const { document } = await setupHydration(template);
    const textarea = document.querySelector(
      '#empty-note'
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe('');

    note.set('filled in');

    expect(textarea.value).toBe('filled in');
  });

  it('does not serialize text separators into a textarea value', async () => {
    const name = Cell.source('world');
    const html = await renderHydrationServerHtml(() => (
      <textarea>Hello {name}</textarea>
    ));

    expect(html).not.toContain('retend:text-separator');
    expect(html).not.toContain('retend:empty-text');
  });

  it('hydrates style text assembled from static and reactive parts', async () => {
    const color = Cell.source('red');
    const template = () => (
      <style id="color-rule">
        {'#target { color: '}
        {color}
        {' }'}
      </style>
    );

    const { document } = await setupHydration(template);
    const style = document.querySelector('#color-rule') as HTMLStyleElement;

    expect(style.textContent).toBe('#target { color: red }');

    color.set('blue');

    expect(style.textContent).toBe('#target { color: blue }');
  });

  it('hydrates an empty style cell without a server text node', async () => {
    const css = Cell.source('');
    const template = () => <style id="empty-rule">{css}</style>;

    const { document } = await setupHydration(template);
    const style = document.querySelector('#empty-rule') as HTMLStyleElement;

    expect(style.textContent).toBe('');

    css.set('body { margin: 0 }');

    expect(style.textContent).toBe('body { margin: 0 }');
  });

  it('hydrates adjacent text directly inside a shadow root', async () => {
    const count = Cell.source(1);
    const template = () => (
      <div id="shadow-text-host">
        <ShadowRoot>Count: {count}</ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const host = document.querySelector('#shadow-text-host');

    expect(host?.shadowRoot?.textContent).toBe('Count: 1');

    count.set(2);

    expect(host?.shadowRoot?.textContent).toBe('Count: 2');
  });

  it('hydrates adjacent text inside a shadow root inside a component', async () => {
    const label = Cell.source('before');
    const Labelled = () => (
      <span>
        <ShadowRoot>{label} and after</ShadowRoot>
      </span>
    );
    const template = () => (
      <div id="nested-shadow-text">
        <Labelled />
      </div>
    );

    const { document } = await setupHydration(template);
    const span = document.querySelector('#nested-shadow-text span');

    expect(span?.shadowRoot?.textContent).toBe('before and after');

    label.set('later');

    expect(span?.shadowRoot?.textContent).toBe('later and after');
  });

  it('hydrates template contents', async () => {
    const template = () => (
      <template id="card-template">
        <span class="card-title">content</span>
      </template>
    );

    const { document } = await setupHydration(template);
    const element = document.querySelector(
      '#card-template'
    ) as HTMLTemplateElement;

    expect(element.content.textContent).toBe('content');
    expect(element.content.querySelector('.card-title')).not.toBeNull();
  });

  it('keeps hydrated template content reactive', async () => {
    const label = Cell.source('first');
    const template = () => (
      <template id="reactive-template">
        <span class="label">{label}</span>
      </template>
    );

    const { document } = await setupHydration(template);
    const element = document.querySelector(
      '#reactive-template'
    ) as HTMLTemplateElement;

    expect(element.content.textContent).toBe('first');

    label.set('second');

    expect(element.content.textContent).toBe('second');
  });

  it('hydrates a template with text only children', async () => {
    const template = () => (
      <template id="text-template">
        {'first'}
        {'second'}
      </template>
    );

    const { document } = await setupHydration(template);
    const element = document.querySelector(
      '#text-template'
    ) as HTMLTemplateElement;

    expect(element.content.textContent).toBe('firstsecond');
  });
});

import { describe, it, expect } from 'vitest';
import { Cell } from 'retend';
import { browserSetup, vDomSetup, timeout } from './setup.tsx';
import { getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';

const runTests = () => {
  it('should handle single class string', () => {
    const element = <div class="container" />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container'
    );
  });

  it('should handle multiple classes string', () => {
    const element = <div class="container main-content" />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container main-content'
    );
  });

  it('should handle class as array of strings', () => {
    const element = <div class={['container', 'main-content']} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container main-content'
    );
  });

  it('should handle class as object with truthy values', () => {
    const element = <div class={{ container: true }} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container'
    );
  });

  it('should handle class as object with falsy values', () => {
    const element = <div class={{ container: false }} />;
    const cls = (element as unknown as Element).getAttribute('class');
    expect(cls === null || cls === '').toBe(true);
  });

  it('should handle reactive class name', () => {
    const className = Cell.source('container');
    const element = <div class={className} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container'
    );

    className.set('updated');
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'updated'
    );
  });

  it('should handle nested reactive class array', () => {
    const className = Cell.source('container');
    const activityClass = Cell.derived(() =>
      className.get() === 'container' ? 'active' : 'inactive'
    );
    const el = (
      <div
        class={[className, activityClass, 'main-content', { hidden: false }]}
      />
    );
    const element = el as unknown as Element;
    expect(element.getAttribute('class')).toBe('container active main-content');

    className.set('changed');
    const classes =
      (element as unknown as Element).getAttribute('class')?.split(' ') || [];
    expect(classes).toContain('changed');
    expect(classes).toContain('inactive');
    expect(classes).toContain('main-content');
    expect(classes.length).toBe(3);
  });

  it('should ignore falsy values in class array', () => {
    const element = (
      <div
        class={[
          'container',
          false,
          'main-content',
          null,
          undefined,
          'extra-style',
        ]}
      />
    );
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container main-content extra-style'
    );
  });

  it('should ignore falsy values in reactive class object', async () => {
    const isContainer = Cell.source(true);
    const isCard = Cell.source(false);
    const element = (
      <div
        class={[
          { isCard },
          {
            container: isContainer,
            hidden: false,
            'another-false': null,
            'yet-another': undefined,
          },
        ]}
      />
    );

    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container'
    );

    isContainer.set(false);
    isCard.set(true);
    await timeout();

    expect((element as unknown as Element).getAttribute('class')).toBe(
      'isCard'
    );
  });

  it('should handle div with no class attribute', () => {
    const element = <div />;
    expect((element as unknown as Element).getAttribute('class')).toBeNull();
  });

  it('should handle div with empty class attribute', () => {
    const element = <div class="" />;
    const cls = (element as unknown as Element).getAttribute('class');
    expect(cls === null || cls === '').toBe(true);
  });

  it('should handle nested arrays flattened', () => {
    //@ts-ignore
    const element = <div class={['container', ['nested', 'array']]} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container nested array'
    );
  });

  it('should handle object with number keys', () => {
    //@ts-ignore
    const element = <div class={{ 123: true, container: true }} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      '123 container'
    );
  });

  it('should handle special characters in class names', () => {
    const element = <div class="class-with-!@#$%^&*_chars" />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'class-with-!@#$%^&*_chars'
    );
  });

  it('should handle mixed array and object', () => {
    const element = (
      <div class={['container', { 'main-content': true }, 'extra-class']} />
    );
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'container main-content extra-class'
    );
  });

  it('should handle span with single class', () => {
    const element = <span class="text-primary" />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary'
    );
  });

  it('should handle span with multiple classes', () => {
    const element = <span class="text-primary bold" />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary bold'
    );
  });

  it('should handle span with class array', () => {
    const element = <span class={['text-secondary', 'italic']} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-secondary italic'
    );
  });

  it('should handle span with class object primary true', () => {
    const element = <span class={{ 'text-primary': true }} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary'
    );
  });

  it('should handle span with class object secondary false', () => {
    const element = <span class={{ 'text-secondary': false }} />;
    const cls = (element as unknown as Element).getAttribute('class');
    expect(cls === null || cls === '').toBe(true);
  });

  it('should handle span with class object primary and bold', () => {
    const element = <span class={{ 'text-primary': true, bold: true }} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary bold'
    );
  });

  it('should handle span with class object secondary true italic false', () => {
    const element = <span class={{ 'text-secondary': true, italic: false }} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-secondary'
    );
  });

  it('should handle span class array and single string', () => {
    const element = <span class={['text-primary', 'bold']} />;
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary bold'
    );
  });

  it('should handle span class object with many styles', () => {
    const element = (
      <span class={{ 'text-primary': true, bold: true, italic: true }} />
    );
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary bold italic'
    );
  });

  it('should handle span class array falsy and strings', () => {
    const element = (
      <span class={['text-primary', null, 'bold', undefined, false]} />
    );
    expect((element as unknown as Element).getAttribute('class')).toBe(
      'text-primary bold'
    );
  });
};

describe('Class Attribute', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

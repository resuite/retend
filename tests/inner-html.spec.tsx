import { Cell } from 'retend';
import { describe, expect, it } from 'vitest';
import { browserSetup, render, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should set innerHTML with a static string', () => {
    const element = render(
      <div dangerouslySetInnerHTML={{ __html: '<span>hello</span>' }} />
    );
    expect(element.innerHTML).toBe('<span>hello</span>');
  });

  it('should set innerHTML with a reactive Cell', () => {
    const html = Cell.source('<span>initial</span>');
    const element = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(element.innerHTML).toBe('<span>initial</span>');
    html.set('<span>updated</span>');
    expect(element.innerHTML).toBe('<span>updated</span>');
  });

  it('should handle Cell starting with an empty string', () => {
    const html = Cell.source('');
    const element = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(element.innerHTML).toBe('');
    html.set('<p>loaded</p>');
    expect(element.innerHTML).toBe('<p>loaded</p>');
  });

  it('should update innerHTML multiple times', () => {
    const html = Cell.source('<b>1</b>');
    const element = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(element.innerHTML).toBe('<b>1</b>');
    html.set('<b>2</b>');
    expect(element.innerHTML).toBe('<b>2</b>');
    html.set('<b>3</b>');
    expect(element.innerHTML).toBe('<b>3</b>');
  });
};

describe('dangerouslySetInnerHTML', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

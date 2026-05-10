import {
  Cell,
  If,
  Switch,
  createUnique,
  getActiveRenderer,
  runPendingSetupEffects,
} from 'retend';
import { Teleport } from 'retend-web';
import { describe, expect, it } from 'vitest';

import { browserSetup, render, timeout, vDomSetup } from './setup.tsx';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

const runTests = () => {
  it('should set an attribute on an element', () => {
    const element = render(<div class="card">Hello, world!</div>);
    expect(element.getAttribute('class')).toBe('card');
  });

  it('should set a reactive attribute on an element', () => {
    const id = Cell.source('id');
    const element = render(<div id={id}>Hello, world!</div>);
    expect(element.getAttribute('id')).toBe('id');
    id.set('another-id');
    expect(element.getAttribute('id')).toBe('another-id');
  });
};

describe('Attributes', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    it('should preserve SVG namespaces and interactivity through component boundaries', () => {
      const clicks = Cell.source(0);
      const IconPart = () => (
        <g id="group">
          <circle
            id="circle"
            cx="10"
            cy="10"
            r="5"
            onClick={() => clicks.set(clicks.get() + 1)}
          />
        </g>
      );
      const element = render(
        <svg id="icon">
          <IconPart />
        </svg>
      );
      const group = element.querySelector('#group');
      const circle = element.querySelector('#circle') as SVGCircleElement;

      expect(element.namespaceURI).toBe(SVG_NAMESPACE);
      expect(group?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(circle.namespaceURI).toBe(SVG_NAMESPACE);

      circle.dispatchEvent(new MouseEvent('click'));
      expect(clicks.get()).toBe(1);
    });

    it('should switch foreignObject descendants back to HTML namespace', () => {
      const ForeignContent = () => <div id="html-content">HTML</div>;
      const element = render(
        <svg id="foreign-root">
          <foreignObject id="foreign-object">
            <ForeignContent />
          </foreignObject>
        </svg>
      );
      const foreignObject = element.querySelector('#foreign-object');
      const content = element.querySelector('#html-content');

      expect(foreignObject?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(content?.namespaceURI).toBe(HTML_NAMESPACE);
      expect(content?.getAttribute('xmlns')).toBeNull();
    });

    it('should preserve MathML namespaces through component boundaries', () => {
      const MathPart = () => (
        <mrow id="math-row">
          <mi id="math-identifier">x</mi>
        </mrow>
      );
      const element = render(
        <math id="math-root">
          <MathPart />
        </math>
      );
      const row = element.querySelector('#math-row');
      const identifier = element.querySelector('#math-identifier');

      expect(element.namespaceURI).toBe(MATH_NAMESPACE);
      expect(row?.namespaceURI).toBe(MATH_NAMESPACE);
      expect(identifier?.namespaceURI).toBe(MATH_NAMESPACE);
    });

    it('should preserve SVG namespaces through reactive If branches', () => {
      const show = Cell.source(true);
      const element = render(
        <svg id="if-svg">
          {If(show, () => (
            <g id="if-group">
              <circle id="if-circle" />
            </g>
          ))}
        </svg>
      );
      let group = element.querySelector('#if-group');
      let circle = element.querySelector('#if-circle');

      expect(group?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(circle?.namespaceURI).toBe(SVG_NAMESPACE);

      show.set(false);
      expect(element.querySelector('#if-group')).toBeNull();

      show.set(true);
      group = element.querySelector('#if-group');
      circle = element.querySelector('#if-circle');
      expect(group?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(circle?.namespaceURI).toBe(SVG_NAMESPACE);
    });

    it('should preserve SVG namespaces through Switch cases', () => {
      const selected = Cell.source('circle');
      const element = render(
        <svg id="switch-svg">
          {Switch(selected, {
            circle: () => <circle id="switch-circle" />,
            rect: () => <rect id="switch-rect" />,
          })}
        </svg>
      );

      expect(element.querySelector('#switch-circle')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );

      selected.set('rect');
      expect(element.querySelector('#switch-rect')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );
    });

    it('should preserve namespaces when teleporting SVG content out of an SVG tree', async () => {
      const target = document.createElement('div');
      target.id = 'svg-teleport-target';
      document.body.append(target);

      const element = render(
        <svg id="teleport-source">
          <Teleport to="#svg-teleport-target">
            <g id="teleported-group">
              <circle id="teleported-circle" />
            </g>
          </Teleport>
        </svg>
      );
      document.body.append(element);
      getActiveRenderer().observer?.flush();

      const group = target.querySelector('#teleported-group');
      const circle = target.querySelector('#teleported-circle');

      expect(group?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(circle?.namespaceURI).toBe(SVG_NAMESPACE);
      expect(
        Reflect.get(element.childNodes[0], '__retendTeleportedContainer')
          ?.namespaceURI
      ).toBe(HTML_NAMESPACE);
    });

    it('should preserve SVG namespaces for Unique components after moves', async () => {
      const slot = Cell.source('first');
      const UniqueIcon = createUnique(() => (
        <g id="unique-group">
          <circle id="unique-circle" />
        </g>
      ));

      const element = render(
        <svg id="unique-svg">
          {If(
            Cell.derived(() => slot.get() === 'first'),
            () => (
              <UniqueIcon id="icon" />
            )
          )}
          {If(
            Cell.derived(() => slot.get() === 'second'),
            () => (
              <UniqueIcon id="icon" />
            )
          )}
        </svg>
      );
      await runPendingSetupEffects();

      expect(element.querySelector('#unique-group')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );
      expect(element.querySelector('#unique-circle')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );

      slot.set('second');
      await runPendingSetupEffects();
      await timeout();

      expect(element.querySelector('#unique-group')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );
      expect(element.querySelector('#unique-circle')?.namespaceURI).toBe(
        SVG_NAMESPACE
      );
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});

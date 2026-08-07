/** @import { Renderer } from './renderer.js' */
import { AsyncCell, SourceCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { Fragment, FragmentPlaceholder, useFragmentCtx } from './fragment.js';
import { createNodesFromTemplate, linkNodes } from './utils.js';

export class Block {
  /**
   * @param {string | Function | FragmentPlaceholder} tagOrFn
   * @param {any} props
   * @param {*} fileData
   */
  constructor(tagOrFn, props, fileData) {
    this.kind =
      tagOrFn === FragmentPlaceholder
        ? 2
        : typeof tagOrFn === 'function'
          ? 1
          : 0;
    this.tagOrFn = tagOrFn;
    this.props = props;
    this.fileData = fileData;
  }

  /** @param {Renderer<any>} renderer */
  instantiate(renderer) {
    const { fileData, kind, props, tagOrFn } = this;

    if (kind === 2) {
      if (!('ref' in props && props.ref instanceof SourceCell)) {
        const group = renderer.createGroup();
        const children = createNodesFromTemplate(props?.children, renderer);
        linkNodes(group, children, renderer);
        const parentFragmentRefCtx = useFragmentCtx();
        parentFragmentRefCtx?.correlate(group, children);
        return group;
      }
      return Fragment(props, renderer);
    }

    if (kind === 1) {
      return renderer.handleComponent(
        /** @type {import('./index.js').__HMR_UpdatableFn} */ (tagOrFn),
        props === undefined ? [] : [props],
        undefined,
        fileData
      );
    }

    const tagname = /** @type {string} */ (tagOrFn);
    let container = renderer.createContainer(tagname, props);
    const children = createNodesFromTemplate(props.children, renderer);
    props.children = children;

    for (const key in props) {
      if (key === 'children') continue;
      const value = props[key];
      if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
      container = renderer.setProperty(container, key, value);
    }

    return linkNodes(container, children, renderer);
  }
}

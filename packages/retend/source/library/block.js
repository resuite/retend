/** @import { Renderer } from './renderer.js' */
import { AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { createNodesFromTemplate, linkNodes } from './utils.js';

export class Block {
  /**
   * @param {string | Function | FragmentPlaceholder} tagOrFn
   * @param {*} props
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
      const group = renderer.createGroup();
      linkNodes(group, props?.children, renderer);
      return group;
    }

    if (kind === 1) {
      return renderer.handleComponent(
        /** @type {import('./index.js').__HMR_UpdatableFn} */ (tagOrFn),
        props === undefined ? [] : [props],
        undefined,
        fileData
      );
    }

    const children = createNodesFromTemplate(props.children, renderer);
    props.children = children;
    let container = renderer.createContainer(
      /** @type {string} */ (tagOrFn),
      props
    );
    for (const key in props) {
      if (key === 'children') continue;
      const value = props[key];
      if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
      container = renderer.setProperty(container, key, value);
    }

    return linkNodes(container, children, renderer);
  }
}

export class FragmentPlaceholder {}

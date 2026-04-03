import type { Cell } from 'retend';

import 'retend/jsx-runtime';

declare module 'retend/jsx-runtime' {
  import('../tree');
  import { CanvasNode } from '../tree';

  namespace JSX {
    type Container<T> = {
      [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
    } & JSX.IntrinsicAttributes;

    interface IntrinsicAttributes {
      ref?: Cell<CanvasNode | null>;
    }

    interface IntrinsicElements {
      rect: Container<{}>;
    }
  }
}

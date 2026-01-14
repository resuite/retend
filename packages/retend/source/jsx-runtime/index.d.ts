export namespace JSX {
  type Booleanish = boolean | 'true' | 'false';
  type Numberish = number | `${number}`;
  type ValueOrCellOrPromise<T> = T | import('retend').Cell<T> | import('retend').AsyncDerivedCell<T>;
  type ValueOrCell<T> = T | import('retend').Cell<T>


  interface IntrinsicAttributes {
    key?: JSX.ValueOrCell<string | number | undefined>;
    children?: Children
  }

  interface JSXDevFileData {
    fileName: string;
    columnNumber: number;
    lineNumber: number;
  }

  export type Children = unknown;
  interface BaseContainerProps extends IntrinsicAttributes {}
  interface LinkElementProps extends IntrinsicAttributes {
    href?: JSX.ValueOrCell<string>;
    onClick?: JSX.ValueOrCell<(event: Event) => void>
    active?: JSX.ValueOrCell<Booleanish>
  }

  // biome-ignore lint/suspicious/noEmptyInterface: should be augmented by renderers.
  interface IntrinsicElements { }
  export type Template = null | undefined | Promise<any> | string | number | boolean | void | object;
  export type Element = Template
}

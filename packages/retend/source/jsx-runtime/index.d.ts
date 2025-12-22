export namespace JSX {
  type Booleanish = boolean | 'true' | 'false';
  type Numberish = number | `${number}`;
  type ElementType = string | ((props: any) => any)
  type Element = any;
  type ValueOrCell<T> = T | import('retend').Cell<T>;


  interface IntrinsicAttributes {
    key?: string | number | symbol;
    children?: Children
  }


  export type Children = unknown;
  interface BaseContainerProps extends IntrinsicAttributes {}
  interface LinkElementProps extends IntrinsicAttributes {
    href?: JSX.ValueOrCell<string>;
    onClick?: JSX.ValueOrCell<(event: Event) => void>
    active?: JSX.ValueOrCell<Booleanish>
  }

  interface IntrinsicElements {}

  export type Template =
    | undefined
    | unknown
    | void
    | null
    // biome-ignore lint/suspicious/noConfusingVoidType:
    | Promise< void | undefined | null>;
}

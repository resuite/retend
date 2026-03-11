import { Renderable } from '@opentui/core';
import { Cell } from 'retend';
import 'retend/jsx-runtime';

declare module 'retend/jsx-runtime' {
  import('@opentui/core'); // beats me.
  import {
    BoxOptions,
    TextOptions,
    InputRenderableOptions,
    SelectRenderableOptions,
    ASCIIFontOptions,
    TabSelectRenderableOptions,
    ScrollBoxOptions,
    CodeOptions,
    TextareaOptions,
    MarkdownOptions,
  } from '@opentui/core';

  namespace JSX {
    type Container<T> = {
      [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
    } & JSX.IntrinsicAttributes;

    interface IntrinsicAttributes {
      ref?: Cell<Renderable | null>;
    }

    interface OpaqueOptions {}

    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements {
      box: Container<BoxOptions>;
      b: Container<TextOptions>;
      i: Container<TextOptions>;
      br: Container<OpaqueOptions>;
      text: Container<TextOptions>;
      input: Container<InputRenderableOptions>;
      select: Container<SelectRenderableOptions>;
      ascii_font: Container<ASCIIFontOptions>;
      tab_select: Container<TabSelectRenderableOptions>;
      scrollbox: Container<ScrollBoxOptions>;
      code: Container<CodeOptions>;
      textarea: Container<TextareaOptions>;
      markdown: Container<OpenTUI.MarkdownOptions>;
    }
  }
}

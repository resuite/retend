declare module 'retend/jsx-runtime' {
  namespace JSX {
    type Booleanish = boolean | 'true' | 'false';
    type Numberish = number | `${number}`;
    type ValueOrCellOrPromise<T> =
      | T
      | import('retend').Cell<T>
      | import('retend').AsyncDerivedCell<T>;
    type ValueOrCell<T> = T | import('retend').Cell<T>;

    /**
     * Unit value type - ONLY strings with "u" or "%" suffix are valid.
     * - "Xu" - Universal units (e.g., "2u" = 16px canvas, 2 chars terminal)
     * - "X%" - Percentage of parent (e.g., "50%" = half of parent dimension)
     */
    type UnitValue = `${number}u` | `${number}%`;

    export interface Style {
      // Dimensions - must use unit values
      width?: JSX.ValueOrCell<UnitValue>;
      height?: JSX.ValueOrCell<UnitValue>;
      maxWidth?: JSX.ValueOrCell<UnitValue>;

      // Spacing - must use unit values
      padding?: JSX.ValueOrCell<UnitValue>;
      rowGap?: JSX.ValueOrCell<UnitValue>;
      columnGap?: JSX.ValueOrCell<UnitValue>;

      // Positioning - must use unit values
      top?: JSX.ValueOrCell<UnitValue>;
      left?: JSX.ValueOrCell<UnitValue>;
      right?: JSX.ValueOrCell<UnitValue>;
      bottom?: JSX.ValueOrCell<UnitValue>;

      // Text - fontSize uses unit values, others are enum/string
      fontSize?: JSX.ValueOrCell<UnitValue>;
      fontWeight?: JSX.ValueOrCell<'normal' | 'bold'>;
      fontFamily?: JSX.ValueOrCell<string>;
      textAlign?: JSX.ValueOrCell<'left' | 'center' | 'right'>;
      textDecoration?: JSX.ValueOrCell<'none' | 'underline'>;
      whiteSpace?: JSX.ValueOrCell<'normal' | 'nowrap'>;

      // Layout - enum values
      flexDirection?: JSX.ValueOrCell<'row' | 'column'>;
      alignItems?: JSX.ValueOrCell<'flex-start' | 'center' | 'flex-end'>;
      justifyContent?: JSX.ValueOrCell<
        'flex-start' | 'center' | 'flex-end' | 'space-between'
      >;
      position?: JSX.ValueOrCell<'absolute' | 'relative'>;

      // Colors - string values
      backgroundColor?: JSX.ValueOrCell<string>;
      color?: JSX.ValueOrCell<string>;
      borderColor?: JSX.ValueOrCell<string>;
    }

    interface IntrinsicAttributes {
      key?: string | number;
      children?: unknown;
    }

    interface ElementProps extends IntrinsicAttributes {
      style?: JSX.ValueOrCell<Style>;
      onClick?: (e: unknown) => void;
    }

    interface IntrinsicElements {
      view: ElementProps;
      text: ElementProps;
    }

    export type Template = object | Promise<unknown>;
  }
}

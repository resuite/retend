import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';

type TextProps = JSX.IntrinsicElements['text'];

interface CheckboxProps extends TextProps {
  isChecked: Cell<boolean>;
}

export function Checkbox(props: CheckboxProps) {
  const { isChecked, ...rest } = props;
  const checkedState = Cell.derived(() => (isChecked.get() ? '✓' : ''));

  return (
    <>
      <text {...rest}>[</text>
      {checkedState}
      <text {...rest}>]</text>
    </>
  );
}

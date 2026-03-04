import type { JSX } from 'retend/jsx-runtime';

import { Card } from './Card';

export type InlineCodeProps = JSX.IntrinsicElements['code'];

export function InlineCode(props: InlineCodeProps) {
  const { class: className, children, ...rest } = props;

  return Card({
    as: 'code',
    class: [
      'px-[0.4em] py-[0.15em] font-mono text-[0.85em] font-medium break-words mx-[0.1em]',
      '!rounded-md !shadow-[-2px_2px_0_var(--color-card-shadow)] dark:!shadow-[-3px_3px_0_var(--color-card-shadow)]',
      className,
    ],
    children,
    ...rest,
  });
}

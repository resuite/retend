import type { JSX } from 'retend/jsx-runtime';

export type CardProps = {
  class?: JSX.ValueOrCell<string | string[] | object>;
  children?: unknown;
  as?: keyof JSX.IntrinsicElements;
  [key: string]: unknown;
};

export function Card(props: CardProps) {
  const { class: className, children, as = 'div', ...rest } = props;

  const cardClasses = [
    'border-border bg-surface rounded-xl border shadow-[-3px_3px_0_var(--color-card-shadow)]',
    'dark:shadow-[-7px_7px_0_var(--color-card-shadow)]',
    'min-w-0',
    className,
  ];

  if (as === 'code') {
    return (
      <code class={cardClasses} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <div class={cardClasses} {...rest}>
      {children}
    </div>
  );
}

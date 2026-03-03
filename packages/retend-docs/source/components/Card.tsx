import type { JSX } from 'retend/jsx-runtime';

export interface CardProps extends JSX.BaseContainerProps {}

export function Card(props: CardProps) {
  const { class: className, children, ...rest } = props;

  return (
    <div
      class={[
        'border-border bg-surface rounded-xl border shadow-[-3px_3px_0_var(--color-card-shadow)]',
        'dark:shadow-[-7px_7px_0_var(--color-card-shadow)]',
        'min-w-0',
        className,
      ]}
      {...rest}
    >
      {children}
    </div>
  );
}

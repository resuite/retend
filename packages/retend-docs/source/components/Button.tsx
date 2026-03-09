import type { JSX } from 'retend/jsx-runtime';

import { Link } from 'retend/router';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = JSX.IntrinsicElements['button'] & {
  href?: string;
  external?: boolean;
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white',
  secondary: 'border-brand bg-white text-fg border dark:bg-surface',
};

export function Button(props: ButtonProps) {
  const {
    href,
    external = false,
    variant = 'primary',
    class: className,
    children,
    disabled,
    type,
    ...rest
  } = props;

  const classNames = [
    'inline-flex w-full items-center justify-center gap-2.5 rounded-lg px-7 py-3 sm:w-auto',
    'dark:shadow-[-4px_4px_0_var(--color-card-shadow)]',
    variantClass[variant],
    className,
  ];

  if (href && external) {
    return (
      <a
        href={href}
        class={classNames}
        target="_blank"
        rel="noreferrer"
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        {children}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} class={classNames} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      class={classNames}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

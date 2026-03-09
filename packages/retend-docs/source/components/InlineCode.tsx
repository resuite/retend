import type { JSX } from 'retend/jsx-runtime';

export type InlineCodeProps = JSX.IntrinsicElements['code'];

export function InlineCode(props: InlineCodeProps) {
  const { key: _key, class: className, children, ...rest } = props;
  return (
    <code
      class={[
        'border-border bg-surface min-w-0 border text-nowrap',
        'mx-[0.1em] px-[0.4em] py-[0.15em] font-mono text-[0.8em] font-medium',
        'rounded-md',
        className,
      ]}
      {...rest}
    >
      {children}
    </code>
  );
}

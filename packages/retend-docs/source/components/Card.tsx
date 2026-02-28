import type { JSX } from 'retend/jsx-runtime';
import { useDerivedValue } from 'retend-utils/hooks';

export interface CardProps extends JSX.BaseContainerProps {
  interactive?: JSX.ValueOrCell<boolean>;
}

export function Card(props: CardProps) {
  const { interactive, class: className, children, ...rest } = props;
  const isInteractive = useDerivedValue(interactive);

  return (
    <div
      class={[
        'border-natural-100 border-border rounded-xl border-[0.5px] bg-white',
        {
          'hover:border-brand transition-all hover:translate-x-px hover:-translate-y-px':
            isInteractive,
        },
        className,
      ]}
      {...rest}
    >
      {children}
    </div>
  );
}

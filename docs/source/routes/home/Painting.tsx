import type { JSX } from 'retend/jsx-runtime';

import type { ClassValue } from './constants';

interface PaintingPanelProps {
  /** Image URL, from `paintings`. */
  painting: string;
  blurred?: boolean;
  /** Load eagerly for the first panel on the page. */
  eager?: boolean;
  class?: ClassValue;
  imageClass?: ClassValue;
  children?: JSX.Template;
}

/** A rounded panel filled with a painting, with product UI floating on top. */
export function PaintingPanel(props: PaintingPanelProps) {
  const {
    painting,
    blurred = false,
    eager = false,
    class: className,
    imageClass,
    children,
  } = props;
  const loading = eager ? 'eager' : 'lazy';

  return (
    <div
      class={[
        'bg-sunken relative isolate overflow-hidden rounded-[20px]',
        className,
      ]}
    >
      <img
        src={painting}
        alt=""
        loading={loading}
        class={[
          'absolute inset-0 -z-10 size-full object-cover',
          { 'home-painting': !blurred, 'home-painting-blurred': blurred },
          imageClass,
        ]}
      />
      {children}
    </div>
  );
}

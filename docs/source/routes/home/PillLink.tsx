import type { JSX } from 'retend/jsx-runtime';

import { AnyLink } from '@/components/AnyLink';

import type { ClassValue } from './constants';

type PillVariant = 'primary' | 'secondary' | 'glass';

interface PillLinkProps {
  href: string;
  variant?: PillVariant;
  external?: boolean;
  class?: ClassValue;
  children?: JSX.Template;
}

const PILL_BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors';

const PILL_VARIANTS: Record<PillVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink/85',
  secondary:
    'border border-line bg-raised text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:border-line-strong',
  glass:
    'border border-white/60 bg-white/55 text-[#1c1917] backdrop-blur-md hover:bg-white/75',
};

/** Pill-shaped call to action, as in the reference heroes. */
export function PillLink(props: PillLinkProps) {
  const {
    href,
    variant = 'primary',
    external = false,
    class: className,
    children,
  } = props;

  return (
    <AnyLink
      href={href}
      external={external}
      class={[PILL_BASE, PILL_VARIANTS[variant], className]}
    >
      {children}
    </AnyLink>
  );
}

import type { JSX } from 'retend/jsx-runtime';

import { Link } from 'retend/router';

interface AnyLinkProps {
  href: string;
  external?: boolean;
  class?: JSX.ValueOrCell<string | string[] | object>;
  children?: JSX.Template;
}

/** Router link for internal pages, new-tab anchor for everything else. */
export function AnyLink(props: AnyLinkProps) {
  const { href, external = false, class: className, children } = props;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" class={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} class={className}>
      {children}
    </Link>
  );
}

/** Arrow that nudges right when a parent `group` is hovered. */
export function Arrow() {
  return (
    <span
      aria-hidden="true"
      class="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
    >
      →
    </span>
  );
}

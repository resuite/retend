import { Link } from 'retend/router';

interface LinkCardProps {
  href: string;
  title: string;
  description: string;
}

/** Internal links only. External links will need their own variant. */
export function LinkCard(props: LinkCardProps) {
  const { href, title, description } = props;

  return (
    <Link
      href={href}
      class="group border-line bg-raised hover:border-accent focus-visible:outline-accent flex flex-col gap-1 rounded-lg border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors"
    >
      <span class="text-body text-ink flex items-center justify-between gap-3 font-medium">
        {title}
        <span
          aria-hidden="true"
          class="text-accent-ink motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
      <span class="text-small text-ink-soft">{description}</span>
    </Link>
  );
}

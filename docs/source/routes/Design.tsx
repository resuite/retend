import { Badge } from '@/ds/Badge';
import { ThemePanel } from '@/ds/ThemePanel';

import { ColorSection } from './design/ColorSection';
import { ComponentsSection } from './design/ComponentsSection';
import { ShellSection } from './design/ShellSample';
import { TypeSection } from './design/TypeSection';

/** Dev-only kitchen sink for the v1 docs design system. */
export default function Design() {
  return (
    <ThemePanel theme="light" class="min-h-screen">
      <div class="mx-auto flex max-w-350 flex-col gap-24 px-5 py-12 sm:px-8 sm:py-16">
        <header class="max-w-2xl">
          <Badge variant="accent">Dev only</Badge>
          <h1 class="text-h1 text-ink mt-4 font-semibold">Design system</h1>
          <p class="text-body text-ink-soft mt-4">
            Every token and component for the new docs, rendered in light and
            dark side by side. This route is not part of the production build.
          </p>
        </header>
        <ColorSection />
        <TypeSection />
        <ComponentsSection />
        <ShellSection />
      </div>
    </ThemePanel>
  );
}

Design.metadata = () => ({ title: 'Design system | Retend' });

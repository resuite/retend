import { For } from 'retend';

import { ThemePair } from '@/ds/ThemePair';

import { Section } from './Section';
import { Swatch } from './Swatch';

interface SwatchSpec {
  token: string;
  against?: string;
  need?: 3 | 4.5;
}

interface SwatchGroup {
  title: string;
  swatches: SwatchSpec[];
}

const CODE_TOKENS = [
  'keyword',
  'function',
  'string',
  'number',
  'property',
  'type',
  'tag',
  'component',
  'comment',
  'boolean',
  'operator',
  'punctuation',
  'builtin',
];

const GROUPS: SwatchGroup[] = [
  {
    title: 'Surfaces',
    swatches: [
      { token: 'paper' },
      { token: 'raised' },
      { token: 'sunken' },
      { token: 'accent-wash' },
      { token: 'good-wash' },
      { token: 'bad-wash' },
    ],
  },
  {
    title: 'Lines',
    swatches: [
      { token: 'line' },
      { token: 'line-strong' },
      { token: 'line-input', against: 'paper', need: 3 },
    ],
  },
  {
    title: 'Text pairs',
    swatches: [
      { token: 'ink', against: 'paper', need: 4.5 },
      { token: 'ink-soft', against: 'paper', need: 4.5 },
      { token: 'ink-faint', against: 'sunken', need: 4.5 },
      { token: 'accent-ink', against: 'paper', need: 4.5 },
      { token: 'accent-ink', against: 'accent-wash', need: 4.5 },
      { token: 'on-accent', against: 'accent-fill', need: 4.5 },
      { token: 'good', against: 'good-wash', need: 4.5 },
      { token: 'bad', against: 'bad-wash', need: 4.5 },
    ],
  },
  {
    title: 'Accent, decorative',
    swatches: [{ token: 'accent', against: 'paper', need: 3 }],
  },
  {
    title: 'Code on sunken',
    swatches: CODE_TOKENS.map((name) => ({
      token: `code-${name}`,
      against: 'sunken',
      need: 4.5,
    })),
  },
];

function ColorGroups() {
  return (
    <div class="flex flex-col gap-8">
      {For(
        GROUPS,
        (group) => (
          <section>
            <h3 class="text-caption text-ink-faint mb-3 font-medium tracking-wider uppercase">
              {group.title}
            </h3>
            <ul class="flex flex-col gap-3">
              {For(
                group.swatches,
                (spec) => (
                  <li>
                    <Swatch
                      token={spec.token}
                      against={spec.against}
                      need={spec.need}
                    />
                  </li>
                ),
                { key: (spec) => `${spec.token}-${spec.against ?? 'none'}` }
              )}
            </ul>
          </section>
        ),
        { key: 'title' }
      )}
    </div>
  );
}

export function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      description="Warm neutrals with the existing orange as the one accent. Ratios are measured from the rendered CSS variables in each theme, so a token edit shows up here on reload."
    >
      <ThemePair render={() => <ColorGroups />} />
    </Section>
  );
}

import { Cell } from 'retend';

import { CityFilter } from './CityFilter';
import { createCityModel, type NodeKind } from './cityModel';
import { FRAME_PAD } from './constants';
import { DependencyChain } from './DependencyChain';
import { PaintingPanel } from './Painting';
import { paintings } from './paintings';
import { PillLink } from './PillLink';
import { SectionHeading } from './SectionHeading';
import { StepList, type Step } from './StepList';

const steps: Step<NodeKind>[] = [
  {
    value: 'source',
    marker: '1.0',
    label: 'Source state',
    title: 'Change state anywhere',
    body: 'query and order are Cells. The search field and the sort button set them, and everything that reads them updates.',
  },
  {
    value: 'derived',
    marker: '1.1',
    label: 'Derived values',
    title: 'Derive what you need',
    body: 'matches and sorted read other Cells and recompute when those change. There is no list of dependencies to keep.',
  },
  {
    value: 'output',
    marker: '1.2',
    label: 'What renders',
    title: 'Only what depends on it updates',
    body: 'Retend tracks those relationships directly, so a change only updates the output that depends on it. Sort the list and the count never hears about it.',
  },
];

export function StateSection() {
  const model = createCityModel();
  const focus = Cell.source<NodeKind>('source');
  const current = Cell.derived(
    () => steps.find((step) => step.value === focus.get())!
  );
  const title = Cell.derived(() => current.get().title);
  const body = Cell.derived(() => current.get().body);

  return (
    <section
      aria-labelledby="home-state-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <div class="grid grid-cols-1 items-end gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-12">
        <SectionHeading
          id="home-state-title"
          lead="State changes"
          rest="and your interface follows."
        />
        <p class="text-ink-soft max-w-md text-[1.0625rem] leading-relaxed text-pretty md:pb-1.5">
          In Retend, state is something you can pass around and render directly.
          Change it anywhere, and everything that depends on it stays up to
          date.
        </p>
      </div>

      <div class="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <StepList
          steps={steps}
          selected={focus}
          onSelect={(value) => focus.set(value)}
          label="Parts of the demo"
        />

        <div>
          <PaintingPanel
            painting={paintings.catskills}
            class="grid grid-cols-1 gap-6 p-4 pb-12 sm:p-6 sm:pb-14 md:h-[34rem] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start md:gap-8 md:p-8"
          >
            <CityFilter model={model} class="md:-mb-14 md:h-[34rem]" />
            <DependencyChain model={model} focus={focus} class="md:pt-6" />
          </PaintingPanel>

          <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div class="max-w-xl" aria-live="polite">
              <h3 class="text-ink text-[1.1875rem] tracking-[-0.01em]">
                {title}
              </h3>
              <p class="text-body text-ink-faint mt-1.5">{body}</p>
            </div>
            <PillLink href="/docs/reactivity-and-cells" class="shrink-0">
              How Cells work
            </PillLink>
          </div>
        </div>
      </div>
    </section>
  );
}

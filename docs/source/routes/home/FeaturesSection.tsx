import type { JSX } from 'retend/jsx-runtime';

import { Cell, Switch } from 'retend';

import { FRAME_PAD } from './constants';
import { FeatureCaption, FeaturePanel } from './FeaturePanel';
import { features, type Feature, type FeatureId } from './features';
import { PaintingPanel } from './Painting';
import { paintings } from './paintings';
import { SectionHeading } from './SectionHeading';
import { StepList } from './StepList';

const featureCases = Object.fromEntries(
  features.map((feature) => [
    feature.value,
    () => <FeatureView feature={feature} />,
  ])
) as Record<FeatureId, () => JSX.Template>;

export function FeaturesSection() {
  const selected = Cell.source<FeatureId>('routing');

  return (
    <section
      aria-labelledby="home-features-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <SectionHeading
        id="home-features-title"
        lead="Enough to build"
        rest="the whole app."
      />

      <div class="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <StepList
          steps={features}
          selected={selected}
          onSelect={(value) => selected.set(value)}
          label="Features"
        />

        <div aria-live="polite">{Switch(selected, featureCases)}</div>
      </div>
    </section>
  );
}

interface FeatureViewProps {
  feature: Feature;
}

function FeatureView(props: FeatureViewProps) {
  const { feature } = props;

  return (
    <>
      <PaintingPanel
        painting={paintings.autumnWoods}
        class="p-4 pt-8 pb-12 sm:p-8 sm:pb-14 md:flex md:h-[35rem] md:items-start md:px-[12%] md:pt-12"
      >
        <FeaturePanel feature={feature} />
      </PaintingPanel>
      <FeatureCaption feature={feature} />
    </>
  );
}

import { For } from 'retend';

import { FEATURES } from '../constants/data';
import {
  ComposableIcon,
  ReactiveIcon,
  PerformanceIcon,
  RoutingIcon,
  AsyncIcon,
  TypescriptIcon,
} from '../icons';
import { Card } from './Card';
import { FeatureCard } from './FeatureCard';
import { SectionHeader } from './SectionHeader';

export function Features() {
  const icons: Record<string, ReturnType<typeof ComposableIcon>> = {
    composable: <ComposableIcon />,
    reactive: <ReactiveIcon />,
    performance: <PerformanceIcon />,
    routing: <RoutingIcon />,
    async: <AsyncIcon />,
    typescript: <TypescriptIcon />,
  };

  return (
    <section id="features">
      <SectionHeader
        label="The Framework"
        title="Built for precision."
        description="A specialized toolkit designed for building performance-critical user interfaces."
      />

      <div class="grid grid-cols-1 gap-y-10 sm:gap-y-12 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
        {For(
          FEATURES,
          (feature) => (
            <Card class="p-6 md:p-8">
              <FeatureCard
                icon={icons[feature.id]}
                title={feature.title}
                description={feature.description}
              />
            </Card>
          ),
          { key: 'id' }
        )}
      </div>
    </section>
  );
}

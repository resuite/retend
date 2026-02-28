import { Card } from './Card';
import { FeatureCard } from './FeatureCard';
import { SectionHeader } from './SectionHeader';

export function ValueProp() {
  return (
    <section>
      <SectionHeader
        label="Core Principles"
        title="Direct to DOM."
        description="Retend maps state changes directly to DOM mutations. By eliminating the virtual diffing layer, your application logic executes with surgical precision and minimal memory overhead."
      />

      <div class="mt-16 grid grid-cols-1 gap-y-15 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
        <Card interactive class="p-8">
          <FeatureCard
            title="Fine-grained"
            description="Updates target specific nodes, not component trees."
          />
        </Card>
        <Card interactive class="p-8">
          <FeatureCard
            title="Declarative"
            description="Express complex logic through pure functional primitives."
          />
        </Card>
        <Card interactive class="p-8">
          <FeatureCard
            title="Lightweight"
            description="A small runtime that stays out of your way."
          />
        </Card>
      </div>
    </section>
  );
}

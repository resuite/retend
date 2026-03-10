import { BlocksIcon, LightningIcon, SlidersIcon } from '../icons';
import { Card } from './Card';
import { FeatureCard } from './FeatureCard';

export function ValueProp() {
  return (
    <section>
      <ul class="grid grid-cols-1 gap-y-10 sm:gap-y-12 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
        <li>
          <Card class="group p-6 md:p-8">
            <FeatureCard
              icon={<BlocksIcon />}
              title="Composable."
              description="Retend enables you to build layouts with small, reusable components, ensuring clean and organized code."
            />
          </Card>
        </li>
        <li>
          <Card class="group p-6 md:p-8">
            <FeatureCard
              icon={<SlidersIcon />}
              title="Reactive."
              description="Retend links your app's state with the user's view, ensuring updates occur instantly when your data changes."
            />
          </Card>
        </li>
        <li>
          <Card class="group p-6 md:p-8">
            <FeatureCard
              icon={<LightningIcon />}
              title="Performant."
              description="Retend updates only the necessary parts of the interface, keeping your apps lightweight on any device."
            />
          </Card>
        </li>
      </ul>
    </section>
  );
}

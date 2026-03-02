import { CallToAction } from '@/components/CallToAction';
import { Ecosystem } from '@/components/Ecosystem';
import { Hero } from '@/components/Hero';
import { RunsOnce } from '@/components/RunsOnce';
import { ValueProp } from '@/components/ValueProp';

export function Home() {
  return (
    <>
      <Hero />
      <ValueProp />
      <RunsOnce />
      <Ecosystem />
      <CallToAction />
    </>
  );
}

import { CallToAction } from '@/components/CallToAction';
import { Ecosystem } from '@/components/Ecosystem';
import { Hero } from '@/components/Hero';
import { ValueProp } from '@/components/ValueProp';
import { Footer } from '@/layouts/Footer';

export function Home() {
  return (
    <>
      <Hero />
      <ValueProp />
      <Ecosystem />
      <CallToAction />
      <Footer />
    </>
  );
}

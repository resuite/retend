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

Home.metadata = () => {
  return {
    title: 'Retend - A simpler way to build user interfaces',
    description:
      'Retend is a modern, lightweight runtime to build incredibly fast, reactive web applications. Get started with the simpler UI framework.',
    ogTitle: 'Retend - A simpler way to build user interfaces',
    ogDescription:
      'Retend is a modern, lightweight runtime to build incredibly fast, reactive web applications. Get started with the simpler UI framework.',
    ogImage: 'https://retend.dev/og/overview.png',
  };
};

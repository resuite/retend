import { Footer } from '@/layouts/Footer';

import { DocsSection } from './home/DocsSection';
import { FeaturesSection } from './home/FeaturesSection';
import { Hero } from './home/Hero';
import { RenderersSection } from './home/RenderersSection';
import { StartSection } from './home/StartSection';
import { StateSection } from './home/StateSection';
import { SurfacesSection } from './home/SurfacesSection';
import { WriteSection } from './home/WriteSection';

/**
 * The landing page sits in a framed column on a grid. The grid fills the
 * margins on both sides and shows through a strip along the top of the
 * column, so it reads as one continuous sheet behind the page.
 */
export function Home() {
  return (
    <div id="top" class="home home-grid">
      <div class="mx-auto max-w-300">
        <div aria-hidden="true" class="h-12" />
        <div class="home-sheet border-accent/50 border-2">
          <Hero />
          <StateSection />
          <WriteSection />
          <RenderersSection />
          <FeaturesSection />
          <SurfacesSection />
          <StartSection />
          <DocsSection />
          <Footer />
        </div>
        <div aria-hidden="true" class="h-12" />
      </div>
    </div>
  );
}

const title = 'Retend – A reactive framework for user interfaces';
const description =
  'Retend gives you JSX, reactive state, and the tools to build complete applications for the web and native desktop.';

Home.metadata = () => {
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage: 'https://retend.dev/og/overview.png',
    ogUrl: 'https://retend.dev/',
    ogType: 'website',
    ogLocale: 'en_US',
    ogLogo: 'https://retend.dev/og/overview.png',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: 'https://retend.dev/og/overview.png',
  };
};

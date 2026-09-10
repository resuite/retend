import { FocusSection } from './sections/focus-section';
import { MeasureSection } from './sections/measure-section';
import { ScrollSection } from './sections/scroll-section';
import { WindowSection } from './sections/window-section';

export default function App() {
  return (
    <div style={{ padding: 24, gap: 16 }}>
      <WindowSection />
      <FocusSection />
      <MeasureSection />
      <ScrollSection />
    </div>
  );
}

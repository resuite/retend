import type { GpuiElement, GpuiScrollOffset } from 'retend-gpui';

import { Cell, For } from 'retend';

const itemCount = 24;

const items: number[] = [];
for (let index = 1; index < itemCount; index += 1) {
  items.push(index);
}

function formatOffset(offset: GpuiScrollOffset | null): string {
  if (!offset) return 'not read yet';
  return `x ${offset.x.toFixed(0)}, y ${offset.y.toFixed(0)}`;
}

export function ScrollSection() {
  const scroller = Cell.source<GpuiElement | null>(null);
  const revealTarget = Cell.source<GpuiElement | null>(null);
  const scrollOffset = Cell.source<GpuiScrollOffset | null>(null);
  const readout = Cell.derived(() => formatOffset(scrollOffset.get()));
  const readScrollOffset = async () => {
    const node = scroller.get();
    if (node) scrollOffset.set(await node.getScrollOffset());
  };
  const handleScroll = () => void readScrollOffset();
  const scrollToTop = () => scroller.get()?.scrollTo(0, 0);
  const scrollDown = () => scroller.get()?.scrollBy(0, 40);
  const revealLastItem = () => revealTarget.get()?.scrollIntoView();

  return (
    <div style={{ gap: 8 }}>
      <div>Scroll offset: {readout}</div>
      <div
        ref={scroller}
        onScroll={handleScroll}
        style={{
          width: 260,
          height: 120,
          overflow: 'auto',
          backgroundColor: '#e6f4ea',
        }}
      >
        {For(items, (item) => (
          <div style={{ padding: 6 }}>Item {item}</div>
        ))}
        <div ref={revealTarget} style={{ padding: 6 }}>
          Item {itemCount}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={scrollToTop}>Top</div>
        <div onClick={scrollDown}>Down 40</div>
        <div onClick={revealLastItem}>Reveal last item</div>
        <div onClick={handleScroll}>Read offset</div>
      </div>
    </div>
  );
}

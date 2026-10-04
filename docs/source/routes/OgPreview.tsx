import { Cell, For } from 'retend';

import { CodeCard } from '@/routes/home/CodeCard';
import { TicketCard } from '@/routes/home/TicketCard';
import { PRICE, SEATS, ticketsCode } from '@/routes/home/tickets';

import iconUrl from '../../assets/icon.svg';

const crosshairs = [
  'top-[62px] left-[520px]',
  'top-[500px] left-[96px]',
  'top-[540px] left-[700px]',
];

/**
 * Dev-only. The social preview image, laid out at exactly 1200 by 630 so a
 * screenshot of #og-root becomes public/og/overview.png. Uses the real
 * landing components, so the card and code match the site.
 */
export default function OgPreview() {
  const quantity = Cell.source(2);
  const seatsLeft = Cell.derived(() => SEATS - quantity.get());
  const total = Cell.derived(() => quantity.get() * PRICE);

  /* The preview is a still image, so the stepper does nothing here. */
  const ignoreChange = () => undefined;

  return (
    <div class="bg-sunken grid min-h-screen place-items-center p-10">
      <div
        id="og-root"
        data-ds-theme="light"
        class="home og-grid bg-paper text-ink relative h-[630px] w-[1200px] overflow-hidden"
      >
        <div
          aria-hidden="true"
          class="border-accent/50 absolute inset-5 rounded-[22px] border-2"
        />
        {For(crosshairs, (position) => (
          <span
            aria-hidden="true"
            class={['text-accent absolute size-5', position]}
          >
            <span class="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 bg-current" />
            <span class="absolute top-0 left-1/2 h-full w-[1.5px] -translate-x-1/2 bg-current" />
          </span>
        ))}

        <div class="absolute top-[72px] left-[80px] flex items-center gap-4">
          <img src={iconUrl} alt="" class="size-12" />
          <span class="text-[2.5rem] leading-none tracking-[-0.03em]">
            retend
          </span>
        </div>

        <div class="absolute top-[218px] left-[80px] w-[560px]">
          <h1 class="text-[3.75rem] leading-[1.06] font-normal tracking-[-0.035em]">
            A reactive framework for user interfaces.
          </h1>
          <p class="text-ink-faint mt-7 text-[1.625rem] leading-[1.35] tracking-[-0.01em]">
            JSX, reactive state, and renderers for web, desktop, server, and
            beyond.
          </p>
        </div>

        <CodeCard
          code={ticketsCode}
          filename="Tickets.tsx"
          tone="dark"
          highlight={[2, 3, 4]}
          class="absolute top-[64px] left-[600px] w-[490px]"
        />
        <div class="absolute top-[236px] left-[848px]">
          <TicketCard
            quantity={quantity}
            seatsLeft={seatsLeft}
            total={total}
            seats={SEATS}
            price={PRICE}
            onChange={ignoreChange}
            class="w-[384px] [zoom:0.82]"
          />
        </div>
      </div>
    </div>
  );
}

OgPreview.metadata = () => ({ title: 'Social preview | Retend' });

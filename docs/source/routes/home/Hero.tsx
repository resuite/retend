import { Cell } from 'retend';

import { GithubIcon } from '@/icons';

import { CodeCard } from './CodeCard';
import { FRAME_PAD, GITHUB_URL } from './constants';
import { PaintingPanel } from './Painting';
import { paintings } from './paintings';
import { PillLink } from './PillLink';
import { TicketCard } from './TicketCard';

const SEATS = 12;
const PRICE = 48;

const ticketsCode = `
function Tickets() {
  const quantity = Cell.source(2);
  const seatsLeft = Cell.derived(() => 12 - quantity.get());
  const total = Cell.derived(() => quantity.get() * 48);

  const add = () => quantity.set(quantity.get() + 1);

  return (
    <>
      <button onClick={add}>Add a ticket</button>
      <p>{seatsLeft} of 12 seats left</p>
      <button type="submit">Pay \${total}</button>
    </>
  );
}
`;

export function Hero() {
  const quantity = Cell.source(2);
  const seatsLeft = Cell.derived(() => SEATS - quantity.get());
  const total = Cell.derived(() => quantity.get() * PRICE);

  const changeQuantity = (by: number) => {
    quantity.set(Math.min(8, Math.max(1, quantity.get() + by)));
  };

  return (
    <section
      aria-labelledby="home-hero-title"
      class={['pt-12 pb-5 sm:pt-14 md:pt-16 md:pb-10', FRAME_PAD]}
    >
      <div class="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-12">
        <h1
          id="home-hero-title"
          class="text-ink text-[clamp(2.25rem,3.8vw,3rem)] leading-[1.08] font-normal tracking-[-0.03em]"
        >
          A reactive framework <br class="hidden sm:block" />
          for user interfaces.
        </h1>

        <div class="flex max-w-md flex-col gap-6 md:pt-1.5">
          <p class="text-ink text-[1.0625rem] leading-relaxed text-pretty">
            Retend gives you JSX, reactive state, and the tools to build
            complete applications for the web, desktop and everywhere else.
          </p>
          <div class="flex flex-wrap gap-2.5">
            <PillLink href="/docs/getting-started">Get started</PillLink>
            <PillLink href={GITHUB_URL} variant="secondary" external>
              <GithubIcon />
              GitHub
            </PillLink>
          </div>
        </div>
      </div>

      <PaintingPanel
        painting={paintings.homeOfTheHeron}
        blurred
        eager
        class="mt-12 flex flex-col gap-4 p-4 sm:p-6 md:mt-16 md:block md:h-[36rem] md:p-0 lg:h-[38rem]"
      >
        <CodeCard
          code={ticketsCode}
          filename="Tickets.tsx"
          tone="dark"
          highlight={[2, 3, 4]}
          class="md:absolute md:top-[9%] md:left-[5%] md:w-[50%]"
          footer={<CodeFooter quantity={quantity} total={total} />}
        />
        <TicketCard
          quantity={quantity}
          seatsLeft={seatsLeft}
          total={total}
          seats={SEATS}
          price={PRICE}
          onChange={changeQuantity}
          class="md:absolute md:top-[20%] md:right-[5%] md:-bottom-6 md:w-[44%]"
        />
      </PaintingPanel>
    </section>
  );
}

interface CodeFooterProps {
  quantity: Cell<number>;
  total: Cell<number>;
}

/** Live values of the snippet's Cells, so the code card answers the clicks. */
function CodeFooter(props: CodeFooterProps) {
  const { quantity, total } = props;

  return (
    <div class="border-line text-caption flex flex-wrap items-center gap-2 border-t px-4 py-3 font-mono">
      <span class="border-line text-ink-soft rounded-md border px-2 py-1">
        quantity <span class="text-ink tabular-nums">{quantity}</span>
      </span>
      <span class="border-line text-ink-soft rounded-md border px-2 py-1">
        total <span class="text-ink tabular-nums">{total}</span>
      </span>
    </div>
  );
}

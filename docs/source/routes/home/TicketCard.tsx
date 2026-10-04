import { Button } from 'innate-ui';
import { Cell, For, If } from 'retend';

import type { ClassValue } from './constants';

import { paintings } from './paintings';

interface TicketCardProps {
  quantity: Cell<number>;
  seatsLeft: Cell<number>;
  total: Cell<number>;
  seats: number;
  price: number;
  /** Asks the owner to add or remove tickets. */
  onChange: (by: number) => void;
  class?: ClassValue;
}

const STEP_CLASS =
  'grid size-7 place-items-center rounded-full border border-line-strong text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-accent';

const ROW = 'grid grid-cols-[6.5rem_1fr] items-center gap-4 py-3.5';

/**
 * The running version of the snippet: one quantity feeds the stepper, the
 * seat count, the seat bars and the pay button.
 */
export function TicketCard(props: TicketCardProps) {
  const {
    quantity,
    seatsLeft,
    total,
    seats,
    price,
    onChange,
    class: className,
  } = props;
  const reserved = Cell.source(false);
  const atMin = Cell.derived(() => quantity.get() <= 1);
  const atMax = Cell.derived(() => quantity.get() >= 8);

  const change = (by: number) => {
    onChange(by);
    reserved.set(false);
  };

  return (
    <div
      class={[
        'home-card bg-raised flex flex-col rounded-[14px] px-3 pt-3 pb-4',
        className,
      ]}
    >
      <img
        src={paintings.mistRising}
        alt=""
        class="h-32 w-full rounded-[10px] object-cover object-[50%_45%] sm:h-36"
      />
      <div class="divide-line divide-y px-2 text-[0.9375rem] sm:px-3">
        <div class={ROW}>
          <span class="text-ink-faint">Trip</span>
          <span class="text-ink">Night train to Lisbon</span>
        </div>
        <div class={ROW}>
          <span class="text-ink-faint">Departs</span>
          <span class="text-ink-soft">Friday 14 November, 22:40</span>
        </div>
        <div class={ROW}>
          <span class="text-ink-faint">Tickets</span>
          <span class="flex items-center gap-3">
            <Button
              class={STEP_CLASS}
              disabled={atMin}
              aria-label="Remove a ticket"
              onClick={() => change(-1)}
            >
              {'−'}
            </Button>
            <output aria-live="polite" class="w-4 text-center tabular-nums">
              {quantity}
            </output>
            <Button
              class={STEP_CLASS}
              disabled={atMax}
              aria-label="Add a ticket"
              onClick={() => change(1)}
            >
              +
            </Button>
            <span class="text-small text-ink-faint">at ${price} each</span>
          </span>
        </div>
        <div class={ROW}>
          <span class="text-ink-faint">Seats left</span>
          <span class="text-ink tabular-nums">
            {seatsLeft} of {seats}
          </span>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-4 px-2 sm:px-3">
        <Button
          class="bg-ink text-small text-paper hover:bg-ink/85 focus-visible:outline-accent flex h-10 shrink-0 items-center justify-center rounded-full px-5 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => reserved.set(true)}
        >
          {If(reserved, {
            true: () => <span>Reserved, ${total}</span>,
            false: () => <span>Pay ${total}</span>,
          })}
        </Button>
        <SeatBars quantity={quantity} seats={seats} />
      </div>
    </div>
  );
}

interface SeatBarsProps {
  quantity: Cell<number>;
  seats: number;
}

/** One thin bar per seat; the ones you are booking turn dark. */
function SeatBars(props: SeatBarsProps) {
  const { quantity, seats } = props;
  const bars = Array.from({ length: seats }, (_, seat) => {
    const taken = Cell.derived(() => seat < quantity.get());
    const free = Cell.derived(() => !taken.get());
    return { taken, free };
  });

  return (
    <span aria-hidden="true" class="flex h-7 flex-1 items-center gap-[7px]">
      {For(bars, (bar) => (
        <span
          class={[
            'h-full w-[3px] rounded-full motion-safe:transition-colors',
            { 'bg-ink': bar.taken, 'bg-line-strong': bar.free },
          ]}
        />
      ))}
    </span>
  );
}

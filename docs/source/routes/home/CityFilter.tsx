import { Button } from 'innate-ui';
import { Cell, For, If } from 'retend';

import type { ClassValue } from './constants';

import { CITIES, type CityModel } from './cityModel';

interface CityFilterProps {
  model: CityModel;
  class?: ClassValue;
}

/** The app half of the reactivity demo: a city list you can filter and sort. */
export function CityFilter(props: CityFilterProps) {
  const { model, class: className } = props;
  const { query, order, sorted, count } = model;
  const isEmpty = Cell.derived(() => count.get() === 0);
  const orderLabel = Cell.derived(() =>
    order.get() === 'asc' ? 'A to Z' : 'Z to A'
  );

  const handleInput = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      query.set(target.value.trim().toLowerCase());
    }
  };

  const toggleOrder = () => {
    order.set(order.get() === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div
      class={[
        'home-card bg-raised flex flex-col overflow-hidden rounded-[14px]',
        className,
      ]}
    >
      <div class="flex items-center gap-2 p-3">
        <label class="sr-only" for="home-city-search">
          Search cities or countries
        </label>
        <input
          id="home-city-search"
          type="search"
          placeholder="Search cities or countries"
          spellcheck={false}
          onInput={handleInput}
          class="border-line bg-paper text-small text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-accent/25 h-10 min-w-0 flex-1 rounded-lg border px-3 focus-visible:outline-2"
        />
        <Button
          onClick={toggleOrder}
          aria-label="Change sort order"
          class="border-line text-small text-ink hover:bg-sunken focus-visible:outline-accent h-10 shrink-0 rounded-lg border px-3 focus-visible:outline-2"
        >
          {orderLabel}
        </Button>
      </div>

      <p
        class="border-line text-caption text-ink-faint border-y px-4 py-2"
        aria-live="polite"
      >
        <span class="text-ink tabular-nums">{count}</span> of {CITIES.length}{' '}
        cities
      </p>

      <ul class="divide-line flex-1 divide-y px-4">
        {For(
          sorted,
          (city) => (
            <li class="flex items-baseline justify-between gap-4 py-2.5">
              <span class="text-small text-ink shrink-0 whitespace-nowrap">
                {city.name}
              </span>
              <span class="text-caption text-ink-faint min-w-0 truncate text-right">
                {city.country}
              </span>
            </li>
          ),
          { key: 'name' }
        )}
      </ul>
      {If(isEmpty, () => (
        <p class="text-small text-ink-soft px-4 pt-3 pb-8">
          No city or country matches “{query}”.
        </p>
      ))}
    </div>
  );
}

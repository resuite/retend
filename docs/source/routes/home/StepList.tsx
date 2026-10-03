import { Cell, For } from 'retend';

export interface Step<T extends string> {
  value: T;
  label: string;
  title: string;
  body: string;
  /** Shown before the label when the steps are a real sequence. */
  marker?: string;
}

interface StepListProps<T extends string> {
  steps: Step<T>[];
  selected: Cell<T>;
  onSelect: (value: T) => void;
  label: string;
}

interface StepButtonProps<T extends string> {
  step: Step<T>;
  selected: Cell<T>;
  onSelect: (value: T) => void;
}

/**
 * The left-hand list beside a panel. Choosing an item changes what the panel
 * shows and the caption under it.
 */
export function StepList<T extends string>(props: StepListProps<T>) {
  const { steps, selected, onSelect, label } = props;

  return (
    <ul
      aria-label={label}
      class="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:mx-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible"
    >
      {For(steps, (step) => (
        <li class="shrink-0">
          <StepButton step={step} selected={selected} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

function StepButton<T extends string>(props: StepButtonProps<T>) {
  const { step, selected, onSelect } = props;
  const isActive = Cell.derived(() => selected.get() === step.value);
  const isIdle = Cell.derived(() => !isActive.get());
  const pressed = Cell.derived(() => (isActive.get() ? 'true' : 'false'));

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onSelect(step.value)}
      class={[
        'group focus-visible:outline-accent flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[0.9375rem] focus-visible:outline-2 motion-safe:transition-colors',
        { 'text-ink': isActive, 'text-ink-faint hover:text-ink-soft': isIdle },
      ]}
    >
      <span class="text-small font-mono tabular-nums empty:hidden">
        {step.marker ?? ''}
      </span>
      <span class="whitespace-nowrap">{step.label}</span>
      <span
        aria-hidden="true"
        class={[
          'text-small motion-safe:transition-transform',
          { 'translate-x-0.5': isActive },
        ]}
      >
        ›
      </span>
    </button>
  );
}

import { Cell } from 'retend';

import { CodeCard } from './CodeCard';
import { FRAME_PAD } from './constants';
import { PaintingPanel } from './Painting';
import { paintings } from './paintings';
import { PillLink } from './PillLink';
import { StepList, type Step } from './StepList';

const taskCode = `
import { Cell, For, If } from 'retend';
import { Input } from 'retend-utils/components';

export function TaskList() {
  const draft = Cell.source('');
  const tasks = Cell.source([{ id: 1, title: 'Ship the docs', done: false }]);
  const remaining = Cell.derived(
    () => tasks.get().filter((task) => !task.done).length
  );

  const addTask = () => {
    const title = draft.get().trim();
    if (!title) return;
    tasks.set([...tasks.get(), { id: Date.now(), title, done: false }]);
    draft.set('');
  };

  return (
    <form onSubmit--prevent={addTask}>
      <Input type="text" model={draft} />
      <ul>
        {For(tasks, (task) => <li>{task.title}</li>, { key: 'id' })}
      </ul>
      {If(remaining, {
        true: () => <p>{remaining} left to do</p>,
        false: () => <p>All done.</p>,
      })}
    </form>
  );
}
`;

type Point = 'deps' | 'memo' | 'jsx' | 'flow';

interface PointNote {
  lines: number[];
  /** Where the note sits: the line it hangs under, and its column. */
  at: [line: number, column: number];
  note: string;
}

const points: Step<Point>[] = [
  {
    value: 'deps',
    label: 'No dependency arrays',
    title: 'No dependency arrays',
    body: 'A derived value finds the state it reads by itself. Read tasks inside it, and it recomputes when tasks changes.',
  },
  {
    value: 'memo',
    label: 'No useMemo or useCallback',
    title: 'No useMemo or useCallback',
    body: 'A component runs once. Its functions and values are made a single time and keep their identity.',
  },
  {
    value: 'jsx',
    label: 'State goes into JSX',
    title: 'State goes straight into JSX',
    body: 'Put a Cell in text, an attribute, a class or a style, and that spot stays current on its own.',
  },
  {
    value: 'flow',
    label: 'Clear tools for change',
    title: 'Clear tools for what can change',
    body: 'If, For and Switch mark the parts of the screen that come and go, so you can see what updates by reading the code.',
  },
];

const notes: Record<Point, PointNote> = {
  deps: { lines: [7, 8, 9], at: [9, 4], note: 'Recomputes when tasks changes' },
  memo: { lines: [11, 12, 13, 14, 15, 16], at: [16, 4], note: 'Created once' },
  jsx: { lines: [20, 25], at: [20, 6], note: 'Stays in step with draft' },
  flow: {
    lines: [22, 24, 25, 26, 27],
    at: [22, 8],
    note: 'Only the list updates when tasks changes',
  },
};

export function WriteSection() {
  const point = Cell.source<Point>('deps');
  const current = Cell.derived(
    () => points.find((item) => item.value === point.get()) ?? points[0]
  );
  const highlight = Cell.derived(() => notes[point.get()].lines);
  const title = Cell.derived(() => current.get().title);
  const body = Cell.derived(() => current.get().body);

  return (
    <section
      aria-labelledby="home-write-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12">
        <p class="text-ink-faint order-last max-w-56 self-end text-[1.0625rem] leading-snug md:order-first">
          Plain functions and plain JavaScript, top to bottom.
        </p>
        <div class="md:text-right">
          <h2
            id="home-write-title"
            class="text-ink text-[clamp(1.75rem,2.8vw,2.25rem)] leading-[1.15] font-normal tracking-[-0.025em]"
          >
            Just write the interface.
          </h2>
          <p class="text-ink-soft mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-pretty md:ml-auto">
            Components are functions. State is ordinary JavaScript you can read
            and change. Events are events. JSX describes what belongs on screen.
          </p>
        </div>
      </div>

      <div class="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <StepList
          steps={points}
          selected={point}
          onSelect={(value) => point.set(value)}
          label="What to notice"
        />

        <div>
          <PaintingPanel
            painting={paintings.beverly}
            class="p-4 pt-10 sm:p-8 sm:pt-12 md:h-[46rem] md:px-[12%] md:pt-14 md:pb-0"
          >
            <CodeCard
              code={taskCode}
              filename="TaskList.tsx"
              highlight={highlight}
              class="md:h-[calc(100%+2rem)]"
              overlay={<CodeNote point={point} />}
            />
          </PaintingPanel>

          <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div class="max-w-xl" aria-live="polite">
              <h3 class="text-ink text-[1.1875rem] tracking-[-0.01em]">
                {title}
              </h3>
              <p class="text-body text-ink-faint mt-1.5">{body}</p>
            </div>
            <PillLink href="/docs/jsx-and-components" class="shrink-0">
              JSX and components
            </PillLink>
          </div>
        </div>
      </div>
    </section>
  );
}

interface CodeNoteProps {
  point: Cell<Point>;
}

/** The dark tooltip that hangs under the line the selected point is about. */
function CodeNote(props: CodeNoteProps) {
  const { point } = props;
  const note = Cell.derived(() => notes[point.get()]);
  const top = Cell.derived(
    () => `calc(1rem + ${note.get().at[0]} * 1.7em + 2px)`
  );
  const left = Cell.derived(() => `calc(1rem + ${note.get().at[1]}ch)`);
  const text = Cell.derived(() => note.get().note);

  return (
    <span
      aria-hidden="true"
      class="pointer-events-none absolute z-10 rounded-md bg-[#1c1917] px-2.5 py-1 font-mono text-[0.6875rem] whitespace-nowrap text-white shadow-lg motion-safe:transition-[top,left] motion-safe:duration-300"
      style={{ top, left }}
    >
      {text}
    </span>
  );
}

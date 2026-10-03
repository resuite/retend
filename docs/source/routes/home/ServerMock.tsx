import { For } from 'retend';

const lines = [
  { text: '<!doctype html>', tone: 'text-ink-faint' },
  { text: '<html lang="en">', tone: 'text-ink-faint' },
  { text: '  <h1>Hello</h1>', tone: 'text-ink' },
  { text: '  <p>Ready on first paint</p>', tone: 'text-ink-soft' },
];

/** An HTML response, for the server card. */
export function ServerMock() {
  return (
    <div
      aria-hidden="true"
      class="home-card border-line bg-raised w-full max-w-64 rounded-t-xl border border-b-0"
    >
      <div class="border-line flex items-center justify-between border-b px-3 py-2 font-mono text-[0.625rem]">
        <span class="text-ink-faint">GET /</span>
        <span class="bg-good-wash text-good rounded-full px-1.5">200</span>
      </div>
      <pre class="overflow-hidden p-3 pb-6 font-mono text-[0.625rem] leading-[1.7]">
        {For(lines, (line) => (
          <span class={['block truncate', line.tone]}>{line.text}</span>
        ))}
      </pre>
    </div>
  );
}

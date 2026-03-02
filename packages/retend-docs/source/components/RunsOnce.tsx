import { CodeBlock } from './CodeBlock';
import { SectionHeader } from './SectionHeader';

const reRenderCode = `function Greeting() {
  const [name, setName] = useState('world');
  const message = \`Hello, \${name}!\`;
  const charCount = message.length;

  return (
    <div>
      <input
        value={name}
        onInput={(e) => setName(e.target.value)}
      />
      <h1>{message}</h1>
      <span>{charCount} characters</span>
    </div>
  );
}`;

const retendCode = `function Greeting() {
  const name = Cell.source('world');
  const message = Cell.derived(() => \`Hello, \${name.get()}!\`);
  const charCount = Cell.derived(() => message.get().length);

  return (
    <div>
      <Input type="text" model={name} />
      <h1>{message}</h1>
      <span>{charCount} characters</span>
    </div>
  );
}`;

export function RunsOnce() {
  return (
    <section>
      <SectionHeader
        label="The Difference"
        title="Components run once."
        description="Retend components are plain functions that execute a single time. State flows through a reactive cell graph — changes propagate directly to the affected DOM nodes. No virtual DOM, no diffing, no re-renders."
      />

      <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div class="mb-4 flex items-center gap-3">
            <span class="bg-surface-alt text-fg-muted rounded-md px-3 py-1 font-mono text-xs">
              Re-rendering model
            </span>
          </div>
          <CodeBlock code={reRenderCode} lang="tsx" />
          <p class="text-fg-muted mt-4 text-sm leading-relaxed">
            The entire function re-executes on every state change.
            All derived values recompute, and the framework diffs a
            virtual tree to find what changed.
          </p>
        </div>

        <div>
          <div class="mb-4 flex items-center gap-3">
            <span class="bg-brand-soft text-brand rounded-md px-3 py-1 font-mono text-xs dark:text-[#7cb8e4]">
              Retend
            </span>
          </div>
          <CodeBlock code={retendCode} lang="tsx" />
          <p class="text-fg-muted mt-4 text-sm leading-relaxed">
            The function runs once. Each <code class="text-fg font-mono text-xs">Cell.derived</code> tracks
            its own dependencies — when <code class="text-fg font-mono text-xs">name</code> changes,
            only the text nodes bound to <code class="text-fg font-mono text-xs">message</code> and{' '}
            <code class="text-fg font-mono text-xs">charCount</code> update.
          </p>
        </div>
      </div>
    </section>
  );
}

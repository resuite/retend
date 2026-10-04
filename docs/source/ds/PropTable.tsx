import { For, If } from 'retend';

export interface PropRow {
  name: string;
  type: string;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

interface PropTableProps {
  rows: PropRow[];
}

export function PropTable(props: PropTableProps) {
  const { rows } = props;

  return (
    <div
      tabIndex={0}
      class="border-line bg-raised focus-visible:outline-accent overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <table class="text-small w-full min-w-[36rem] border-collapse text-left">
        <thead class="bg-sunken text-caption text-ink-soft">
          <tr>
            <th class="px-4 py-2.5 font-medium">Prop</th>
            <th class="px-4 py-2.5 font-medium">Type</th>
            <th class="px-4 py-2.5 font-medium">Default</th>
            <th class="px-4 py-2.5 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {For(
            rows,
            (row) => (
              <tr class="border-line border-t align-top">
                <td class="px-4 py-3 whitespace-nowrap">
                  <code class="text-accent-ink font-mono">{row.name}</code>
                  {If(row.required === true, () => (
                    <>
                      <span aria-hidden="true" class="text-bad ml-0.5">
                        *
                      </span>
                      <span class="sr-only"> (required)</span>
                    </>
                  ))}
                </td>
                <td class="px-4 py-3">
                  <code class="bg-sunken text-caption text-ink rounded px-1.5 py-0.5 font-mono">
                    {row.type}
                  </code>
                </td>
                <td class="px-4 py-3">
                  <code class="text-caption text-ink-soft font-mono">
                    {row.defaultValue ?? '—'}
                  </code>
                </td>
                <td class="text-ink-soft px-4 py-3">{row.description}</td>
              </tr>
            ),
            { key: 'name' }
          )}
        </tbody>
      </table>
    </div>
  );
}

import type { PropRow } from '@/ds/PropTable';

import { InlineCode } from '@/components/InlineCode';
import { CodeFrame } from '@/ds/CodeFrame';
import { PropTable } from '@/ds/PropTable';
import { Step, Steps } from '@/ds/Steps';

const ROWS: PropRow[] = [
  {
    name: 'code',
    type: 'string',
    required: true,
    description: 'Source text to display and copy.',
  },
  {
    name: 'lang',
    type: 'string',
    required: true,
    description:
      'One of tsx, jsx, ts, js, sh, bash. Other values render as plain text.',
  },
  {
    name: 'filename',
    type: 'string',
    description: 'Shows a caption bar above the code.',
  },
  {
    name: 'highlight',
    type: 'number[]',
    defaultValue: '[]',
    description: 'Line numbers to emphasize, starting at 1.',
  },
  {
    name: 'bare',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Removes the border and radius, for use inside Tabs.',
  },
];

export function StructureDemo() {
  return (
    <div class="flex flex-col gap-10">
      <Steps>
        <Step title="Create a project">
          <p>Run the scaffold command in a terminal.</p>
          <CodeFrame lang="sh" code="npx retend-start@latest my-app" />
        </Step>
        <Step title="Install and start the dev server">
          <CodeFrame lang="sh" code={'cd my-app\nnpm install\nnpm run dev'} />
        </Step>
        <Step title="Edit the app">
          <p>
            Open <InlineCode>source/App.tsx</InlineCode> and replace its
            contents.
          </p>
        </Step>
      </Steps>
      <PropTable rows={ROWS} />
    </div>
  );
}

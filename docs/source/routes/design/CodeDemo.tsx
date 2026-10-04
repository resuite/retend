import type { PackageCommands } from '@/ds/PackageTabs';
import type { TabItems } from '@/ds/Tabs';
import type { PanelTheme } from '@/ds/ThemePanel';

import { Callout } from '@/ds/Callout';
import { CodeFrame } from '@/ds/CodeFrame';
import { PackageTabs } from '@/ds/PackageTabs';
import { Tabs } from '@/ds/Tabs';

import { COUNTER_SAMPLE, SERVER_SAMPLE, WEB_SAMPLE } from './samples';

interface CodeDemoProps {
  theme: PanelTheme;
}

const CREATE_COMMANDS: PackageCommands = {
  npm: 'npx retend-start@latest my-app',
  pnpm: 'pnpm dlx retend-start@latest my-app',
  yarn: 'yarn dlx retend-start@latest my-app',
  bun: 'bunx retend-start@latest my-app',
};

export function CodeDemo(props: CodeDemoProps) {
  const { theme } = props;

  const targets: TabItems = [
    {
      id: 'web',
      label: 'Web',
      content: () => <CodeFrame bare lang="tsx" code={WEB_SAMPLE} />,
    },
    {
      id: 'server',
      label: 'Server',
      content: () => <CodeFrame bare lang="ts" code={SERVER_SAMPLE} />,
    },
    {
      id: 'gpui',
      label: 'GPUI',
      content: () => (
        <div class="p-4">
          <Callout variant="warning" title="Experimental">
            <p>The GPUI renderer is experimental.</p>
          </Callout>
        </div>
      ),
    },
  ];

  return (
    <div class="flex flex-col gap-8">
      <CodeFrame
        filename="source/App.tsx"
        lang="tsx"
        code={COUNTER_SAMPLE}
        highlight={[4, 7]}
      />
      <PackageTabs
        id={`create-${theme}`}
        label="Create a project"
        commands={CREATE_COMMANDS}
      />
      <Tabs id={`target-${theme}`} label="Render target" tabs={targets} />
    </div>
  );
}

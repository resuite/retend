import type { TabItems } from './Tabs';

import { CodeFrame } from './CodeFrame';
import { Tabs } from './Tabs';

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number];
export type PackageCommands = Record<PackageManager, string>;

interface PackageTabsProps {
  id: string;
  label: string;
  commands: PackageCommands;
}

/**
 * One tab per package manager. Commands are passed explicitly because they do
 * not translate mechanically (npx / pnpm dlx / yarn dlx / bunx).
 */
export function PackageTabs(props: PackageTabsProps) {
  const { id, label, commands } = props;
  const [firstManager, ...otherManagers] = PACKAGE_MANAGERS;
  const tabs: TabItems = [
    {
      id: firstManager,
      label: firstManager,
      content: () => <CodeFrame bare lang="sh" code={commands[firstManager]} />,
    },
    ...otherManagers.map((manager) => ({
      id: manager,
      label: manager,
      content: () => <CodeFrame bare lang="sh" code={commands[manager]} />,
    })),
  ];

  return <Tabs id={id} label={label} tabs={tabs} />;
}

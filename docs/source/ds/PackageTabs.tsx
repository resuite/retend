import type { TabItem } from './Tabs';

import { CodeFrame } from './CodeFrame';
import { Tabs } from './Tabs';

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type PackageCommands = Record<PackageManager, string>;

interface PackageTabsProps {
  id: string;
  label: string;
  commands: PackageCommands;
}

const MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

/**
 * One tab per package manager. Commands are passed explicitly because they do
 * not translate mechanically (npx / pnpm dlx / yarn dlx / bunx).
 */
export function PackageTabs(props: PackageTabsProps) {
  const { id, label, commands } = props;

  const tabFor = (manager: PackageManager): TabItem => ({
    id: manager,
    label: manager,
    content: () => <CodeFrame bare lang="sh" code={commands[manager]} />,
  });

  const tabs = MANAGERS.map(tabFor);

  return <Tabs id={id} label={label} tabs={tabs} />;
}

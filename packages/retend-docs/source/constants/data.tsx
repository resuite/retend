export interface QuickstartStep {
  id: string;
  title: string;
  detail: string;
  command: string;
}

export const QUICKSTART_STEPS: QuickstartStep[] = [
  {
    id: '01',
    title: 'Install',
    detail: 'Initialize a new project with the CLI.',
    command: 'pnpm create retend-app',
  },
  {
    id: '02',
    title: 'Run',
    detail: 'Spin up the local development environment.',
    command: 'pnpm dev',
  },
  {
    id: '03',
    title: 'Build',
    detail: 'Compile for production deployment.',
    command: 'pnpm build',
  },
];

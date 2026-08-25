import type { ResolvedConfig } from 'vite';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  retendGpui,
  type RetendGpuiOptions,
  type RetendGpuiPlugin,
} from '../source/plugins/vite.js';

type TransformResult = { code: string } | null;

const temporaryRoots: string[] = [];

function options(): RetendGpuiOptions {
  return {
    app: {
      name: 'Test',
      identifier: 'dev.retend.test',
      version: '1.0.0',
      icon: './icon.svg',
    },
    application: './source/application.ts',
    entry: './source/main.ts',
    window: { width: 800, height: 600 },
  };
}

function resolvePlugin(plugin: RetendGpuiPlugin, command = 'serve'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-vite-'));
  temporaryRoots.push(root);
  const hook = plugin.configResolved as (config: ResolvedConfig) => void;
  hook({ command, root } as ResolvedConfig);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('retendGpui Vite plugin', () => {
  it('requires application identity and a process-wide application module', () => {
    expect(() => retendGpui(options())).not.toThrow();
    expect(() => retendGpui({ ...options(), application: '' })).toThrow(
      '`application` path'
    );
    expect(() =>
      retendGpui({
        ...options(),
        app: { ...options().app, version: 'not-semver' },
      })
    ).toThrow('valid SemVer');
  });

  it('generates the configured application context declaration', () => {
    const root = resolvePlugin(retendGpui(options()));
    const declaration = fs.readFileSync(
      path.join(root, 'node_modules/@types/retend-gpui-app/index.d.ts'),
      'utf8'
    );

    expect(declaration).toContain(
      "InstanceType<typeof Application>['context']"
    );
    expect(declaration).toContain('interface GpuiAppContextTypes');
  });

  it('rejects production builds until the production path exists', () => {
    expect(() => resolvePlugin(retendGpui(options()), 'build')).toThrow(
      'production builds are not implemented'
    );
  });

  it('treats a non-JSX configured entry as an HMR boundary', () => {
    const plugin = retendGpui(options());
    const root = resolvePlugin(plugin);
    const transform = plugin.transform as (
      code: string,
      id: string
    ) => TransformResult;
    const result = transform(
      'export default function App() {}',
      path.join(root, 'source/main.ts')
    );

    expect(result?.code).toContain('hotReloadModule');
  });

  it('never treats the configured application module as an HMR boundary', () => {
    const plugin = retendGpui({
      ...options(),
      application: './source/application.tsx',
    });
    const root = resolvePlugin(plugin);
    const transform = plugin.transform as (
      code: string,
      id: string
    ) => TransformResult;

    expect(
      transform(
        'export default class Application {}',
        path.join(root, 'source/application.tsx')
      )
    ).toBeNull();
  });

  it('full reloads when an update reaches the application dependency graph', async () => {
    const plugin = retendGpui(options());
    const root = resolvePlugin(plugin);
    const applicationModule = {
      id: path.join(root, 'source/application.ts'),
      importers: new Set(),
    };
    const dependencyModule = {
      id: path.join(root, 'source/shared.tsx'),
      importers: new Set([applicationModule]),
    };
    const invalidateModule = vi.fn();
    const send = vi.fn();
    const hotUpdate = plugin.hotUpdate as Function;

    const result = await Reflect.apply(
      hotUpdate,
      {
        environment: {
          moduleGraph: { invalidateModule },
          hot: { send },
        },
      },
      [
        {
          type: 'update',
          file: dependencyModule.id,
          timestamp: 1,
          modules: [dependencyModule],
          read: async () => '',
          server: {},
        },
      ]
    );

    expect(result).toEqual([]);
    expect(invalidateModule).toHaveBeenCalledWith(
      dependencyModule,
      expect.any(Set),
      1,
      true
    );
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
  });
});

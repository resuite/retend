import type { ResolvedConfig } from 'vite';

import { EventEmitter } from 'node:events';
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

interface TestConfigInput {
  root?: string;
}

interface TestCommandEnv {
  command: string;
}

interface TestBuildOptions {
  ssr?: boolean;
  outDir?: string;
}

interface TestEnvironmentOptions {
  input?: string;
  build?: TestBuildOptions;
}

interface TestEnvironments {
  gpui: TestEnvironmentOptions;
}

interface TestConfigResult {
  builder?: unknown;
  environments: TestEnvironments;
}

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

  it('configures a single-environment production build', () => {
    const plugin = retendGpui({ ...options(), target: 'darwin-arm64' });
    const config = plugin.config as unknown as (
      config: TestConfigInput,
      env: TestCommandEnv
    ) => TestConfigResult;

    const result = config({}, { command: 'build' });
    // The multi-environment builder is opt-in; without it Vite builds `client`.
    expect(result.builder).toEqual({});
    expect(result.environments.gpui.input).toBe(
      'virtual:retend-gpui/production-entry'
    );
    expect(result.environments.gpui.build?.ssr).toBe(true);
    expect(result.environments.gpui.build?.outDir).toContain(
      path.join('dist', 'darwin-arm64')
    );
  });

  it('loads a production entry that boots the configured application', () => {
    const plugin = retendGpui({ ...options(), target: 'darwin-arm64' });
    const config = plugin.config as unknown as (
      config: TestConfigInput,
      env: TestCommandEnv
    ) => unknown;
    config(
      { root: path.join(os.tmpdir(), 'retend-gpui-app') },
      { command: 'build' }
    );

    const load = plugin.load as unknown as (id: string) => string | null;
    const source = load('\0virtual:retend-gpui/production-entry') ?? '';
    expect(source).toContain('from "/source/application.ts"');
    expect(source).toContain('from "/source/main.ts"');
    expect(source).toContain('startProductionApp');
    expect(source).toContain('retend-gpui-native.darwin-arm64.node');
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
    const invalidateAll = vi.fn();
    const send = vi.fn();
    const hotUpdate = plugin.hotUpdate as Function;

    const result = await Reflect.apply(
      hotUpdate,
      {
        environment: {
          moduleGraph: { invalidateAll },
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
    expect(invalidateAll).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('full reloads the configured application module by file path', async () => {
    const plugin = retendGpui(options());
    const root = resolvePlugin(plugin);
    const invalidateAll = vi.fn();
    const send = vi.fn();
    const hotUpdate = plugin.hotUpdate as Function;

    const result = await Reflect.apply(
      hotUpdate,
      {
        environment: {
          moduleGraph: { invalidateAll },
          hot: { send },
        },
      },
      [
        {
          type: 'update',
          file: path.join(root, 'source/application.ts'),
          timestamp: 1,
          modules: [],
          read: async () => '',
          server: {},
        },
      ]
    );

    expect(result).toEqual([]);
    expect(invalidateAll).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('full reloads the next source change after the child reports an unavailable entry', async () => {
    const plugin = retendGpui(options());
    resolvePlugin(plugin);
    const child = Object.assign(new EventEmitter(), {
      connected: true,
      send: vi.fn(),
    });
    plugin.api.hotChannel.attach(child as never);
    child.emit('message', {
      channel: 'vite',
      payload: {
        type: 'custom',
        event: 'retend-gpui:entry-failed',
        data: null,
      },
    });

    const invalidateAll = vi.fn();
    const send = vi.fn();
    const hotUpdate = plugin.hotUpdate as Function;
    const result = await Reflect.apply(
      hotUpdate,
      {
        environment: {
          moduleGraph: { invalidateAll },
          hot: { send },
        },
      },
      [
        {
          type: 'update',
          file: '/source/app.tsx',
          timestamp: 1,
          modules: [],
          read: async () => '',
          server: {},
        },
      ]
    );

    expect(result).toEqual([]);
    expect(invalidateAll).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    child.emit('exit');
  });
});

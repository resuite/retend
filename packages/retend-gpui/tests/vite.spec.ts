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

function resolvePlugin(
  plugin: RetendGpuiPlugin,
  command = 'serve',
  publicDir?: string | false
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-vite-'));
  temporaryRoots.push(root);
  const hook = plugin.configResolved as (config: ResolvedConfig) => void;
  hook({ command, root, publicDir } as ResolvedConfig);
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
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

  it('generates the configured application context declaration when it is missing', () => {
    const root = resolvePlugin(retendGpui(options()));
    const declaration = fs.readFileSync(
      path.join(root, 'retend-gpui-env.d.ts'),
      'utf8'
    );

    expect(declaration).toContain(
      "import type Application from './source/application.ts'"
    );
    expect(declaration).toContain(
      "InstanceType<typeof Application>['context']"
    );
    expect(declaration).toContain('interface GpuiAppContextTypes');
    expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(false);
  });

  it('repairs a stale application context declaration', () => {
    const plugin = retendGpui(options());
    const root = resolvePlugin(plugin);
    const declarationPath = path.join(root, 'retend-gpui-env.d.ts');
    fs.writeFileSync(declarationPath, 'stale\n');

    const hook = plugin.configResolved as (config: ResolvedConfig) => void;
    hook({ command: 'serve', root } as ResolvedConfig);

    expect(fs.readFileSync(declarationPath, 'utf8')).toContain(
      "import type Application from './source/application.ts'"
    );
  });

  it('does not rewrite an unchanged application context declaration', () => {
    const plugin = retendGpui(options());
    const root = resolvePlugin(plugin);
    const writeFileSync = vi.spyOn(fs, 'writeFileSync');

    const hook = plugin.configResolved as (config: ResolvedConfig) => void;
    hook({ command: 'serve', root } as ResolvedConfig);

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('exposes the configured identity and system options to the development runtime', () => {
    const plugin = retendGpui({
      ...options(),
      system: { transparentTitlebar: true },
    });
    const root = resolvePlugin(plugin);

    expect(plugin.api.launch).toMatchObject({
      appName: 'Test',
      identifier: 'dev.retend.test',
      icon: path.join(root, 'icon.svg'),
      system: { transparentTitlebar: true },
      publicDir: null,
    });
  });

  it('exposes the resolved public directory to the development runtime', () => {
    const plugin = retendGpui(options());
    resolvePlugin(plugin, 'serve', '/demo/public');

    expect(plugin.api.launch?.publicDir).toBe('/demo/public');
  });

  it('reports a null public directory when Vite disables it', () => {
    const plugin = retendGpui(options());
    resolvePlugin(plugin, 'serve', false);

    expect(plugin.api.launch?.publicDir).toBeNull();
  });

  it('prefers the platform icon override for the development runtime', () => {
    const plugin = retendGpui({
      ...options(),
      app: { ...options().app, macos: { icon: './mac-icon.png' } },
    });
    const root = resolvePlugin(plugin);

    expect(plugin.api.launch?.icon).toBe(path.join(root, 'mac-icon.png'));
  });

  it('prefers the Windows icon override for the development runtime', () => {
    const plugin = retendGpui({
      ...options(),
      app: { ...options().app, windows: { icon: './win-icon.ico' } },
    });
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    try {
      Object.defineProperty(process, 'platform', {
        ...platform,
        value: 'win32',
      });
      const root = resolvePlugin(plugin);
      expect(plugin.api.launch?.icon).toBe(path.join(root, 'win-icon.ico'));
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
  });

  it('reports a null development icon when the application defines none', () => {
    const plugin = retendGpui({
      ...options(),
      app: { ...options().app, icon: undefined },
    });
    resolvePlugin(plugin);

    expect(plugin.api.launch?.icon).toBeNull();
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

  it('generates a production entry that imports the configured modules and the runtime bootstrap', () => {
    const plugin = retendGpui({
      ...options(),
      target: 'darwin-arm64',
      system: { transparentTitlebar: true },
    });
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
    expect(source).toContain(
      "import { startProductionApp } from 'retend-gpui/runtime';"
    );
    expect(source).toContain('retend-gpui-native.darwin-arm64.node');
    expect(source).toContain('system: {"transparentTitlebar":true}');
  });

  it('copies the Windows icon into the production bundle', async () => {
    const plugin = retendGpui({
      ...options(),
      target: 'win32-x64',
      app: {
        ...options().app,
        windows: { icon: './windows-icon.svg' },
      },
    });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-win-'));
    temporaryRoots.push(root);
    fs.writeFileSync(path.join(root, 'windows-icon.svg'), '<svg/>');
    const config = plugin.config as unknown as (
      config: TestConfigInput,
      env: TestCommandEnv
    ) => unknown;
    config({ root }, { command: 'build' });
    const configResolved = plugin.configResolved as (
      config: ResolvedConfig
    ) => void;
    configResolved({ command: 'build', root } as ResolvedConfig);

    const output = path.join(root, 'dist', 'win32-x64');
    fs.mkdirSync(output, { recursive: true });
    const writeBundle = plugin.writeBundle as Function;
    await Reflect.apply(writeBundle, { info: vi.fn() }, [{ dir: output }, {}]);
    expect(fs.readFileSync(path.join(output, 'AppIcon.svg'), 'utf8')).toBe(
      '<svg/>'
    );
  });

  it('packages again on every build, including after a failed attempt', async () => {
    const plugin = retendGpui({
      ...options(),
      target: 'win32-x64',
      app: {
        ...options().app,
        windows: { icon: './windows-icon.svg' },
      },
    });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-rebuild-'));
    temporaryRoots.push(root);
    const config = plugin.config as unknown as (
      config: TestConfigInput,
      env: TestCommandEnv
    ) => unknown;
    config({ root }, { command: 'build' });
    const configResolved = plugin.configResolved as (
      config: ResolvedConfig
    ) => void;
    configResolved({ command: 'build', root } as ResolvedConfig);

    const output = path.join(root, 'dist', 'win32-x64');
    const addon = path.join(
      output,
      'native',
      'retend-gpui-native.win32-x64-msvc.node'
    );
    const writeBundle = plugin.writeBundle as Function;
    const build = async (): Promise<void> => {
      // `emptyOutDir` clears the output before every build.
      fs.rmSync(output, { recursive: true, force: true });
      fs.mkdirSync(output, { recursive: true });
      await Reflect.apply(writeBundle, { info: vi.fn() }, [
        { dir: output },
        {},
      ]);
    };

    // The configured icon does not exist yet, so the first build fails.
    await expect(build()).rejects.toThrow('application icon not found');

    fs.writeFileSync(path.join(root, 'windows-icon.svg'), '<svg/>');
    for (let rebuild = 0; rebuild < 2; rebuild++) {
      await build();
      expect(fs.existsSync(addon)).toBe(true);
      expect(fs.existsSync(path.join(output, 'AppIcon.svg'))).toBe(true);
    }
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

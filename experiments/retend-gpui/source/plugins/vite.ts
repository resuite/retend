import fs from 'node:fs';
import path from 'node:path';
import {
  DevEnvironment,
  normalizePath,
  type EnvironmentModuleNode,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from 'vite';

import type { DevRuntimeConfig } from '../runtime/protocol.js';

import { IpcHotChannel } from '../runtime/ipc-hot-channel.js';
import {
  validateGpuiWindowOptions,
  type GpuiWindowOptions,
} from '../window.js';

/** Stable Vite plugin name used for lookup via `getRetendGpuiPluginApi`. */
export const RETEND_GPUI_PLUGIN_NAME = 'retend-gpui';

export interface RetendGpuiEnvironmentReadyEvent {
  root: string;
  api: RetendGpuiPluginApi;
}

interface RetendGpuiDevServer extends ViteDevServer {
  __retendGpuiEnvironmentReady?: (
    event: RetendGpuiEnvironmentReadyEvent
  ) => void;
}

/** @internal Watches for a fresh GPUI environment after Vite restarts. */
export function onRetendGpuiEnvironmentReady(
  server: ViteDevServer,
  listener: (event: RetendGpuiEnvironmentReadyEvent) => void
): () => void {
  const owner = server as RetendGpuiDevServer;
  owner.__retendGpuiEnvironmentReady = listener;
  return () => delete owner.__retendGpuiEnvironmentReady;
}

/** Canonical application identity used by development and future packaging. */
export interface RetendGpuiPlatformMetadata {
  icon?: string;
}

export interface RetendGpuiAppMetadata {
  name: string;
  identifier: string;
  version: string;
  icon: string;
  description?: string;
  publisher?: string;
  macos?: RetendGpuiPlatformMetadata;
  windows?: RetendGpuiPlatformMetadata;
}

/** Initial Vite-managed window configuration. */
export interface RetendGpuiInitialWindowOptions extends GpuiWindowOptions {
  width: number;
  height: number;
}

/**
 * Options for the `retendGpui` Vite plugin.
 */
export interface RetendGpuiOptions {
  /** Canonical application identity shared by development and production. */
  app: RetendGpuiAppMetadata;
  /** Path to the module whose default export is the application class. */
  application: string;
  /** Path to the application entry module, relative to Vite root (e.g. `"source/main.tsx"`). */
  entry: string;
  /** Default window options used for the initial dev window spawned by the supervisor. */
  window: RetendGpuiInitialWindowOptions;
}

/**
 * Live API exposed on the Vite plugin instance via the `api` property.
 * Provides access to resolved options and the shared hot channel.
 */
export interface RetendGpuiPluginApi {
  /** Concrete development launch configuration after Vite resolves its root. */
  launch: DevRuntimeConfig | null;
  /** IPC-backed Vite hot channel shared between server and child processes. */
  hotChannel: IpcHotChannel;
}

/** Vite plugin augmented with the Retend GPUI API. */
export type RetendGpuiPlugin = Plugin & { api: RetendGpuiPluginApi };

function validateOptions(options: RetendGpuiOptions): void {
  if (!options.app) throw new Error('retendGpui() requires `app` metadata.');
  for (const name of ['name', 'icon'] as const) {
    if (!options.app[name])
      throw new Error(`retendGpui() requires \`app.${name}\`.`);
  }
  if (!/^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)+$/.test(options.app.identifier)) {
    throw new Error(
      'retendGpui() requires `app.identifier` to be a reverse-DNS identifier.'
    );
  }
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      options.app.version
    )
  ) {
    throw new Error('retendGpui() requires `app.version` to be valid SemVer.');
  }
  for (const name of ['application', 'entry'] as const) {
    if (!options[name])
      throw new Error(`retendGpui() requires an \`${name}\` path.`);
  }
  if (!options.window)
    throw new Error('retendGpui() requires `window` options.');
  for (const name of ['width', 'height'] as const) {
    if (options.window[name] === undefined)
      throw new Error(`retendGpui() requires \`window.${name}\`.`);
  }
  validateGpuiWindowOptions(options.window);
}

function updateReachesApplication(
  modules: EnvironmentModuleNode[],
  application: string
): boolean {
  const pending = [...modules];
  const visited = new Set<EnvironmentModuleNode>();

  while (pending.length > 0) {
    const module = pending.pop()!;
    if (visited.has(module)) continue;
    visited.add(module);

    const cleanId = module.id ? normalizePath(module.id.split('?', 1)[0]) : '';
    if (cleanId === application) return true;
    pending.push(...module.importers);
  }

  return false;
}

function writeAppContextTypes(root: string, application: string): void {
  const targetDirectory = path.join(
    root,
    'node_modules',
    '@types',
    'retend-gpui-app'
  );
  const applicationPath = path.resolve(root, application);
  let importPath = normalizePath(
    path.relative(targetDirectory, applicationPath)
  );
  if (!importPath.startsWith('.')) importPath = `./${importPath}`;

  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(targetDirectory, 'index.d.ts'),
    `import type Application from ${JSON.stringify(importPath)};

type ConfiguredAppContext = InstanceType<typeof Application>['context'];

declare module 'retend-gpui' {
  interface GpuiAppContextTypes {
    application: ConfiguredAppContext;
  }
}

export {};
`
  );
}

/**
 * Vite plugin that configures the `gpui` environment, injects HMR wiring,
 * and hosts the dev supervisor's hot channel.
 *
 * Must be included in `vite.config.ts` for `retend-gpui dev` to function.
 *
 * @param options - Application metadata, module paths, and initial window configuration.
 * @returns A Vite plugin with an attached `api` containing the live hot channel.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { retendGpui } from "retend-gpui/plugins/vite";
 *
 * export default defineConfig({
 *   plugins: [retendGpui({
 *     app: { name: "App", identifier: "com.example.app", version: "1.0.0", icon: "icon.png" },
 *     application: "source/application.ts",
 *     entry: "source/main.tsx",
 *     window: { width: 800, height: 600 },
 *   })],
 * });
 * ```
 */
export function retendGpui(options: RetendGpuiOptions): RetendGpuiPlugin {
  validateOptions(options);
  const hotChannel = new IpcHotChannel();

  const plugin: RetendGpuiPlugin = {
    name: RETEND_GPUI_PLUGIN_NAME,
    api: { launch: null, hotChannel },

    config() {
      return {
        appType: 'custom',
        server: {
          middlewareMode: true,
          perEnvironmentStartEndDuringDev: true,
          ws: false,
        },
        oxc: {
          jsx: {
            runtime: 'automatic',
            importSource: 'retend',
          },
        },
        resolve: {
          dedupe: ['retend', 'retend-gpui', '@adbl/cells'],
        },
        optimizeDeps: {
          exclude: ['retend', 'retend-gpui', '@adbl/cells'],
        },
        environments: {
          gpui: {
            consumer: 'server',
            keepProcessEnv: true,
            resolve: {
              external: ['retend', 'retend-gpui', '@adbl/cells'],
            },
            dev: {
              createEnvironment(name, config, context) {
                const environment = new DevEnvironment(name, config, {
                  ...context,
                  hot: true,
                  transport: hotChannel,
                });
                const listen = environment.listen.bind(environment);
                environment.listen = async (server) => {
                  await listen(server);
                  (
                    server as RetendGpuiDevServer
                  ).__retendGpuiEnvironmentReady?.({
                    root: config.root,
                    api: plugin.api,
                  });
                };
                return environment;
              },
            },
          },
        },
      };
    },

    configResolved(config: ResolvedConfig) {
      if (config.command === 'build') {
        throw new Error(
          'Retend GPUI production builds are not implemented yet. Use `retend-gpui dev` for the current prototype.'
        );
      }
      plugin.api.launch = {
        appName: options.app.name,
        application: normalizePath(
          path.resolve(config.root, options.application)
        ),
        entry: normalizePath(path.resolve(config.root, options.entry)),
        options: {
          ...options.window,
          title: options.window.title ?? options.app.name,
          location: options.window.location ?? '/',
        },
      };
      writeAppContextTypes(config.root, options.application);
    },

    applyToEnvironment(environment) {
      return environment.name === 'gpui';
    },

    hotUpdate({ modules, timestamp }) {
      const application = plugin.api.launch?.application;
      if (!application || !updateReachesApplication(modules, application))
        return;

      const invalidatedModules = new Set<EnvironmentModuleNode>();
      for (const module of modules) {
        this.environment.moduleGraph.invalidateModule(
          module,
          invalidatedModules,
          timestamp,
          true
        );
      }
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    },

    transform(code, id) {
      if (id.includes('node_modules')) return null;

      const cleanId = normalizePath(id.split('?', 1)[0]);
      const launch = plugin.api.launch;
      if (!launch || cleanId === launch.application) return null;

      const isComponentModule =
        cleanId.endsWith('.jsx') ||
        cleanId.endsWith('.tsx') ||
        cleanId.endsWith('.mdx');
      if (!isComponentModule && cleanId !== launch.entry) return null;

      return {
        code: `
import { hotReloadModule as __RETEND_GPUI_HMR__ } from 'retend-gpui/plugins/hmr';

${code}

if (import.meta.hot) {
  const __RETEND_GPUI_HMR_CURRENT_MODULE__ = import(
    /* @vite-ignore */ import.meta.url
  );
  import.meta.hot.accept(async (newModule) => {
    __RETEND_GPUI_HMR__(newModule, await __RETEND_GPUI_HMR_CURRENT_MODULE__);
  });
}
`,
        map: null,
      };
    },
  };

  return plugin;
}

/**
 * Retrieves the live API from a resolved Vite config that includes `retendGpui()`.
 *
 * @param config - Resolved Vite config (e.g. `server.config`).
 * @returns The plugin API containing options and the hot channel.
 * @throws If no `retend-gpui` plugin is present in the config.
 */
export function getRetendGpuiPluginApi(
  config: ResolvedConfig
): RetendGpuiPluginApi {
  const plugin = config.plugins.find(
    (candidate) => candidate.name === RETEND_GPUI_PLUGIN_NAME
  ) as RetendGpuiPlugin | undefined;
  if (!plugin?.api) {
    throw new Error(
      'No retendGpui() plugin was found. Add retendGpui(...) to vite.config.ts.'
    );
  }
  return plugin.api;
}

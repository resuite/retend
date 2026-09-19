import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DevEnvironment,
  normalizePath,
  type EnvironmentOptions,
  type EnvironmentModuleNode,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from 'vite';

import type { DevRuntimeConfig } from '../runtime/protocol.js';

import { nativeTargetPlatform } from '../native/addon.js';
import { buildDmg, buildMacApp } from '../packaging/macos.js';
import {
  acquireNodeRuntime,
  DEFAULT_NODE_VERSION,
} from '../packaging/node-runtime.js';
import { notarizeDmg, resolveNotaryCredentials } from '../packaging/notary.js';
import { IpcHotChannel } from '../runtime/ipc-hot-channel.js';
import {
  validateGpuiWindowOptions,
  type GpuiWindowOptions,
} from '../window.js';

/** Stable Vite plugin name used for lookup via `getRetendGpuiPluginApi`. */
export const RETEND_GPUI_PLUGIN_NAME = 'retend-gpui';

/** Virtual module id for the bundled production application entry. */
const PRODUCTION_ENTRY_ID = 'virtual:retend-gpui/production-entry';
const RESOLVED_PRODUCTION_ENTRY_ID = `\0${PRODUCTION_ENTRY_ID}`;
const SUPPORTED_TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64',
] as const;

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

/** Canonical application identity shared by development and production packaging. */
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
  /** Build target as `<platform>-<arch>`; defaults to the host. */
  target?: string;
  /** Embedded Node.js version; defaults to `DEFAULT_NODE_VERSION`. */
  node?: string;
  /** Developer ID signing and notarization for macOS builds. */
  signing?: RetendGpuiSigningOptions;
}

/** Developer ID signing and notarization for macOS builds. */
export interface RetendGpuiSigningOptions {
  /**
   * `codesign` identity, e.g. `Developer ID Application: Name (TEAMID)`.
   * Falls back to `RETEND_GPUI_SIGN_IDENTITY`.
   */
  identity?: string;
  /** Custom entitlements plist; a JIT-capable default is generated. */
  entitlements?: string;
  /**
   * `notarytool` keychain profile. Falls back to `RETEND_GPUI_NOTARY_PROFILE`,
   * then to the `APPLE_*` environment variables.
   */
  notaryProfile?: string;
  /** Set to `false` to skip notarization. */
  notarize?: boolean;
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

/** Source of the bundled production entry. */
function productionEntrySource(
  options: RetendGpuiOptions,
  root: string,
  target: string
): string {
  const modulePath = (relative: string): string =>
    normalizePath(`/${path.relative(root, path.resolve(root, relative))}`);
  const windowOptions = {
    ...options.window,
    title: options.window.title ?? options.app.name,
    location: options.window.location ?? '/',
  };
  const platform = nativeTargetPlatform(target);
  return `import { fileURLToPath } from 'node:url';
import Application from ${JSON.stringify(modulePath(options.application))};
import Root from ${JSON.stringify(modulePath(options.entry))};
import { startProductionApp } from 'retend-gpui';

await startProductionApp({
  Application,
  Root,
  appName: ${JSON.stringify(options.app.name)},
  options: ${JSON.stringify(windowOptions)},
  nativeAddonPath: fileURLToPath(
    new URL('./native/retend-gpui-native.${platform}.node', import.meta.url)
  ),
});
`;
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
  let productionTarget: string | null = null;
  let productionRoot: string | null = null;
  let productionOutputDir: string | null = null;
  let productionAddonCopied = false;
  let entryFailed = false;
  hotChannel.on('vite:client:connect', () => {
    entryFailed = false;
  });
  hotChannel.on('retend-gpui:entry-failed', () => {
    entryFailed = true;
  });
  hotChannel.on('retend-gpui:entry-ready', () => {
    entryFailed = false;
  });

  const plugin: RetendGpuiPlugin = {
    name: RETEND_GPUI_PLUGIN_NAME,
    api: { launch: null, hotChannel },

    config(userConfig, env) {
      const isBuild = env.command === 'build';
      const root = userConfig.root
        ? path.resolve(userConfig.root)
        : process.cwd();
      if (isBuild) {
        const target = options.target ?? `${process.platform}-${process.arch}`;
        if (
          !SUPPORTED_TARGETS.includes(
            target as (typeof SUPPORTED_TARGETS)[number]
          )
        ) {
          throw new Error(
            `retendGpui() received an unsupported build target: ${target}.`
          );
        }
        productionTarget = target;
        productionRoot = root;
        productionOutputDir = path.resolve(root, 'dist', target);
      }

      const gpuiEnvironment: EnvironmentOptions = isBuild
        ? {
            input: PRODUCTION_ENTRY_ID,
            build: {
              outDir: productionOutputDir ?? undefined,
              emptyOutDir: true,
              ssr: true,
              emitAssets: true,
              assetsDir: 'assets',
              assetsInlineLimit: 0,
              rollupOptions: {
                output: {
                  format: 'es' as const,
                  entryFileNames: 'index.js',
                  codeSplitting: false,
                },
              },
            },
          }
        : {
            // Keep dev asset imports as URLs too; inlining them as data URLs
            // would not be loadable by the native renderer.
            build: {
              assetsInlineLimit: 0,
            },
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
          };

      return {
        appType: 'custom',
        // Vite only sets up non-client environments when `builder` is set.
        ...(isBuild ? { builder: {} } : {}),
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
            ...gpuiEnvironment,
          },
        },
      };
    },

    configResolved(config: ResolvedConfig) {
      writeAppContextTypes(config.root, options.application);
      if (config.command === 'build') {
        productionRoot = config.root;
        plugin.api.launch = null;
        return;
      }
      plugin.api.launch = {
        appName: options.app.name,
        root: config.root,
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
    },

    resolveId(id) {
      if (id === PRODUCTION_ENTRY_ID) return RESOLVED_PRODUCTION_ENTRY_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_PRODUCTION_ENTRY_ID) return null;
      const root = productionRoot;
      const target = productionTarget;
      if (!root || !target) {
        throw new Error(
          'Retend GPUI production entry was loaded without a resolved target.'
        );
      }
      return productionEntrySource(options, root, target);
    },

    async buildApp(builder) {
      if (!productionTarget) return;
      const environment = builder.environments.gpui;
      if (!environment) {
        throw new Error(
          `Retend GPUI build environment was not configured. Environments: ${Object.keys(builder.environments).join(', ')}`
        );
      }
      await builder.build(environment);
    },

    async writeBundle(outputOptions) {
      if (
        !productionTarget ||
        productionAddonCopied ||
        !productionOutputDir ||
        outputOptions.dir !== productionOutputDir
      ) {
        return;
      }
      productionAddonCopied = true;
      const platform = nativeTargetPlatform(productionTarget);
      const binaryName = `retend-gpui-native.${platform}.node`;
      const source = fileURLToPath(
        new URL(`../../native/npm/${platform}/${binaryName}`, import.meta.url)
      );
      if (!fs.existsSync(source)) {
        throw new Error(
          `Retend GPUI is missing the prebuilt ${productionTarget} addon. Run \`retend-gpui native:build\` or install retend-gpui-native-${platform}.`
        );
      }
      const destination = path.join(productionOutputDir, 'native', binaryName);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);

      // Application bundles are only produced for Apple-silicon macOS. Every
      // other target stops at the runnable bundle directory assembled above.
      if (productionTarget !== 'darwin-arm64') {
        this.info(
          `retend-gpui: application packaging is not implemented for ${productionTarget}; emitted the bundle directory instead.`
        );
        return;
      }

      const root = productionRoot ?? process.cwd();
      const nodeBinary = await acquireNodeRuntime({
        version: options.node ?? DEFAULT_NODE_VERSION,
        target: productionTarget,
        cacheDir: path.join(root, 'node_modules', '.cache', 'retend-gpui'),
      });
      const iconSetting = options.app.macos?.icon ?? options.app.icon;
      const signingOptions = options.signing;
      const identity =
        signingOptions?.identity ?? process.env.RETEND_GPUI_SIGN_IDENTITY;
      const notaryCredentials = resolveNotaryCredentials(
        signingOptions,
        process.env
      );
      const appDir = buildMacApp({
        appName: options.app.name,
        identifier: options.app.identifier,
        version: options.app.version,
        bundleEntry: path.join(productionOutputDir, 'index.js'),
        addonPath: destination,
        outputDir: productionOutputDir,
        nodeBinary,
        icon: iconSetting ? path.resolve(root, iconSetting) : undefined,
        signing: identity
          ? {
              identity,
              entitlements: signingOptions?.entitlements
                ? path.resolve(root, signingOptions.entitlements)
                : undefined,
            }
          : undefined,
        log: (message) => this.info(message),
      });
      const dmgPath = buildDmg({
        appDir,
        outputDir: productionOutputDir,
        appName: options.app.name,
      });
      if (identity && notaryCredentials) {
        notarizeDmg({
          dmgPath,
          credentials: notaryCredentials,
          log: (message) => this.info(message),
        });
      }
      this.info(
        `retend-gpui: packaged ${path.relative(root, appDir)} and ${path.relative(root, dmgPath)}`
      );
      if (!identity) {
        this.warn(
          `"${options.app.name}.app" is signed ad-hoc, not with a Developer ID ` +
            'certificate, so it is not notarized. Running it on this machine is ' +
            'unaffected, but anyone who downloads it from the web will see macOS ' +
            'refuse to open it ("Apple could not verify ...") and many will not get ' +
            'past that dialog. To ship a distributable build, set `signing.identity` ' +
            '(or RETEND_GPUI_SIGN_IDENTITY) and provide notarization credentials.'
        );
      } else if (!notaryCredentials) {
        this.warn(
          `"${options.app.name}.app" is signed but not notarized. Gatekeeper still ` +
            'blocks unnotarized apps on download, so users will see the same ' +
            '"Apple could not verify ..." dialog. Provide notarization credentials ' +
            '(`signing.notaryProfile`, RETEND_GPUI_NOTARY_PROFILE, or the APPLE_* ' +
            'environment variables) to finish the job.'
        );
      }
    },

    applyToEnvironment(environment) {
      return environment.name === 'gpui';
    },

    hotUpdate({ file, modules }) {
      const application = plugin.api.launch?.application;
      if (
        !application ||
        (!entryFailed &&
          normalizePath(file) !== application &&
          !updateReachesApplication(modules, application))
      ) {
        return;
      }

      const hot = this.environment.hot;
      this.environment.moduleGraph.invalidateAll();
      setTimeout(() => hot.send({ type: 'full-reload' }), 0);
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

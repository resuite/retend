import type { Router } from '@adbl/unfinished/router';
import type { VWindow } from '@adbl/unfinished/v-dom';
import type { AsyncLocalStorage } from 'node:async_hooks';
import type { UserConfig, ViteDevServer } from 'vite';

export interface RouterModule {
  createRouter: () => Router;
}

export interface ServerContext {
  path: string;
  rootSelector: string;
  shell: Record<string, unknown>;
  consistentValues: Record<string, unknown>;
}

export interface OutputArtifact {
  name: string;
  contents: string;
}

export interface BuildOptions {
  viteConfig?: UserConfig;
  htmlEntry?: string;
  rootSelector?: string;
  createRouterModule?: string;
}

export interface WriteArtifactsOptions {
  outDir?: string;
  clean?: boolean;
}

export interface ViteBuildResult {
  output: Array<{
    code: string;
    source: string;
    fileName: string;
  }>;
}

export interface AsyncStorage {
  window: VWindow;
  path: string;
  teleportIdCounter: { value: number };
  consistentValues: Map<string, unknown>;
}

export interface RenderOptions {
  path: string;
  routerPath: string;
  asyncLocalStorage: AsyncLocalStorage<AsyncStorage>;
  htmlShellSource: string;
  server: ViteDevServer;
  rootSelector: string;
}

import { createScope, useScopeContext } from 'retend';

import type { DevToolsDOMRenderer } from './devtools-renderer';

export const DevToolsRendererScope =
  createScope<DevToolsDOMRenderer>('DevToolsRenderer');

export function useDevToolsRenderer() {
  return useScopeContext(DevToolsRendererScope);
}

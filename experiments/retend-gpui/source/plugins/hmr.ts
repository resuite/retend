import type { JSX } from 'retend/jsx-runtime';

import {
  Cell,
  CellUpdateError,
  __HMR_SYMBOLS,
  branchState,
  createNodesFromTemplate,
  onSetup,
  withState,
  type __HMR_UpdatableFn,
  type SourceCell,
  type StateSnapshot,
} from 'retend';
import { getGlobalContext } from 'retend/context';
import { routeToComponent } from 'retend/router';

import type { RetendGpuiRenderer } from '../gpui-renderer.js';
import type { GpuiGroup, GpuiNode, GpuiRange } from '../tree/nodes.js';

interface HotUpdate {
  previous: __HMR_UpdatableFn;
  next: __HMR_UpdatableFn;
  invalidator?: SourceCell<__HMR_UpdatableFn>;
  routes?: NonNullable<ReturnType<typeof routeToComponent.get>>;
}

type HmrContext = {
  current: SourceCell<Function | null>;
  old: unknown[];
  new: unknown[];
};

/**
 * Transfers live Retend component invalidators from an old module to its replacement.
 * Also migrates router bindings so existing routes point at the new component.
 * Invoked automatically by the Vite transform injected in `retendGpui`.
 *
 * @param newModule - Replacement module namespace produced by Vite HMR.
 * @param oldModule - Previous module namespace that owns the live invalidators.
 * @throws If a previously rendered component export no longer exists in the new module.
 * @throws `AggregateError` if updating any invalidator fails.
 */
export function hotReloadModule(
  newModule: Record<string, unknown> | undefined,
  oldModule: Record<string, unknown> | undefined
): void {
  if (!newModule || !oldModule) return;

  const updates: HotUpdate[] = [];
  for (const [key, previousValue] of Object.entries(oldModule)) {
    if (typeof previousValue !== 'function') continue;

    const previous = previousValue as __HMR_UpdatableFn;
    const invalidator = Reflect.get(
      previous,
      __HMR_SYMBOLS.ComponentInvalidator
    ) as SourceCell<__HMR_UpdatableFn> | undefined;
    const routes = routeToComponent.get(previous);
    if (!invalidator && !routes) continue;

    const nextValue = newModule[key];
    if (typeof nextValue !== 'function') {
      throw new Error(
        `Cannot hot-reload rendered export \`${key}\` because the replacement module no longer exports a component function under that name.`
      );
    }
    updates.push({
      previous,
      next: nextValue as __HMR_UpdatableFn,
      invalidator,
      routes,
    });
  }

  const errors: unknown[] = [];
  const context: HmrContext = {
    current: Cell.source<Function | null>(null),
    old: Object.values(oldModule),
    new: Object.values(newModule),
  };
  const { globalData } = getGlobalContext();
  globalData.set(__HMR_SYMBOLS.HMRContextKey, context);

  try {
    for (const { previous, next, invalidator, routes } of updates) {
      if (routes) {
        for (const match of routes) match.component = next;
        routeToComponent.set(next, routes);
        routeToComponent.delete(previous);
      }
      if (!invalidator) continue;

      try {
        Reflect.set(next, __HMR_SYMBOLS.ComponentInvalidator, invalidator);
        context.current.set(next);
        invalidator.set(next);
      } catch (error) {
        if (error instanceof CellUpdateError) errors.push(...error.errors);
        else throw error;
      }
    }
  } finally {
    globalData.delete(__HMR_SYMBOLS.HMRContextKey);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'Retend GPUI HMR update failed.');
  }
}

function trackScopeReference(
  component: __HMR_UpdatableFn,
  fileName: string
): void {
  const Scope = component.__isScopeProviderOf;
  if (!Scope) return;

  const scopeList = __HMR_SYMBOLS.ScopeList;
  if (!Reflect.get(Scope, __HMR_SYMBOLS.HmrId)) {
    const description = Scope.key.description;
    let uniqueId = description ? `${fileName}-${description}` : fileName;
    while (scopeList.has(uniqueId)) uniqueId += '_';
    scopeList.set(uniqueId, Scope);
    Reflect.set(Scope, __HMR_SYMBOLS.HmrId, uniqueId);
  }

  const hmrId = Reflect.get(Scope, __HMR_SYMBOLS.HmrId) as string;
  scopeList.set(hmrId, Scope);
  onSetup(() => () => scopeList.delete(hmrId));
}

function renderComponent(
  invalidator: SourceCell<__HMR_UpdatableFn>,
  props: any[],
  renderer: RetendGpuiRenderer
): GpuiNode[] {
  const ancestry = __HMR_SYMBOLS.useComponentAncestry();
  const template = __HMR_SYMBOLS.RetendComponentTree.Provider({
    h: false,
    value: [...ancestry, invalidator.peek()],
    children: () => invalidator.peek()(...props, { createdByJsx: true }),
  });
  return createNodesFromTemplate(template, renderer);
}

function instanceIsCoveredByParentUpdate(fn: __HMR_UpdatableFn): boolean {
  const hmr = __HMR_SYMBOLS.getHMRContext();
  if (!hmr || hmr.current.peek() !== fn) return false;
  const parents = __HMR_SYMBOLS.useComponentAncestry();
  return parents.some(
    (component) =>
      (component !== fn && hmr.old.includes(component)) ||
      hmr.new.includes(component)
  );
}

/**
 * Creates a JavaScript-only logical range that can be replaced during HMR.
 * Each component invocation gets its own range so hot updates can surgically
 * re-render only the affected instance without tearing down sibling nodes.
 *
 * @param component - Component function to render inside the boundary.
 * @param props - Props array forwarded to the component.
 * @param fileData - Dev file metadata used to register scope providers for HMR.
 * @param renderer - Renderer that owns the group and range.
 * @returns A `GpuiGroup` containing the HMR boundary anchors and current output.
 */
export function withHMRBoundaries(
  component: __HMR_UpdatableFn,
  props: any[],
  fileData: JSX.JSXDevFileData | undefined,
  renderer: RetendGpuiRenderer
): GpuiGroup {
  if (fileData) trackScopeReference(component, fileData.fileName);

  let invalidator = Reflect.get(
    component,
    __HMR_SYMBOLS.ComponentInvalidator
  ) as SourceCell<__HMR_UpdatableFn> | undefined;
  if (!invalidator) {
    invalidator = Cell.source(component);
    Reflect.set(component, __HMR_SYMBOLS.ComponentInvalidator, invalidator);
  }

  const group = renderer.createGroup();
  const handle = renderer.createGroupHandle(group) as GpuiRange;
  const snapshot: StateSnapshot = branchState();

  const refresh = (fn: __HMR_UpdatableFn): void => {
    if (withState(snapshot, () => instanceIsCoveredByParentUpdate(fn))) return;

    snapshot.node.dispose();
    renderer.write(handle, []);
    renderer.flush();

    try {
      withState(snapshot, () => {
        renderer.write(handle, renderComponent(invalidator, props, renderer));
      });
    } finally {
      withState(snapshot, () => invalidator.listen(refresh));
      void snapshot.node.activate();
    }
    renderer.flush();
  };

  withState(snapshot, () => {
    renderer.write(handle, renderComponent(invalidator, props, renderer));
    invalidator.listen(refresh);
  });

  return group;
}

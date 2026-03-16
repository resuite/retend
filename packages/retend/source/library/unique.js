/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { StateSnapshot, Scope } from '../library/scope.js' */

import { Cell } from '@adbl/cells';

import { createGroupFromNodes } from '../_internals.js';
import { getGlobalContext } from '../context/index.js';
import {
  __HMR_SYMBOLS,
  branchState,
  createScope,
  onSetup,
  useScopeContext,
  withState,
} from '../library/scope.js';
import { useAwait } from './await.js';

const StashSymbol = Symbol('UniqueStash');
/** @type {Scope<Set<UniqueMoveFn>>} */
const UniqueScope = createScope('Unique');

/**
 * @typedef {WeakMap<object, Map<string | Function, UniqueCtx>>} RendererUniqueStash
 */

/**
 * @typedef UniqueCtx
 * @property {SourceCell<UniqueProps<any>>} props
 * @property {StateSnapshot} state
 * @property {Set<UniqueMoveFn>} moveFns
 * @property {Array<() => void>} restoreFns
 * @property {any[]} journey
 * @property {any} activeHandle
 * @property {(() => void) | null} teardown
 * @property {boolean} isStable
 */

/**
 * @template {{}} Props
 * @typedef {{ id?: string } & Props} UniqueProps
 */

/**
 * @template {{}} Props
 * @typedef {(props: UniqueProps<Props>) => JSX.Template} UniqueComponent
 */

/**
 * @template {{}} Props
 * @typedef {(props: Cell<UniqueProps<Props>>) => JSX.Template} UniqueComponentRenderFn
 */

/**
 * @typedef {() => void | (() => void)} UniqueMoveFn
 */

/** @param {UniqueMoveFn} callback */
export function onMove(callback) {
  const set = useScopeContext(UniqueScope);
  set.add(callback);
}

/** @param {UniqueCtx} inst */
const save = (inst) => {
  inst.moveFns.forEach((move) => {
    try {
      const restoreFn = move();
      if (restoreFn) inst.restoreFns.push(restoreFn);
    } catch (e) {
      console.error(e);
    }
  });
};

/** @param {UniqueCtx} inst */
const restore = (inst) => {
  inst.restoreFns.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
  inst.restoreFns.length = 0;
};

/**
 * @param {UniqueCtx} inst
 * @param {Map<any, UniqueCtx>} instances
 * @param {any} key
 */
const dispose = (inst, instances, key) => {
  inst.state.node.enable();
  inst.state.node.dispose();
  instances.delete(key);
};

/**
 * Creates a component that preserves its identity and internal state
 * even when its position in the render tree changes. Rather than being destroyed
 * and recreated each time it renders, it persists one instance across different locations.
 *
 * By default, the component's identity is tied to the render function itself. To distinguish
 * between multiple shared instances of the same component, you can provide an explicit `id` prop.
 *
 * Props remain fully reactive: any changes propagate through a Cell and automatically
 * trigger re-evaluation of any derived values or effects inside the component.
 *
 * When a unique instance is removed from one place in the UI and later rendered elsewhere,
 * it carries over its entire state intact, including:
 * - All child nodes and their internal state
 * - Any scoped reactive computations
 *
 * The component is only fully disposed once it is no longer rendered anywhere.
 *
 * Common use cases include:
 * - Media players that need to keep their playback position and state
 *   during navigation or layout shifts
 * - Form inputs that should retain their value, focus, and caret position
 * - Expensive computations, WebSocket connections, or other heavy resources
 *   that shouldn't be torn down unnecessarily
 * - Stateful widgets that are moved between different containers or tabs
 *
 * @template {{}} Props - Props type (excluding id, which is added automatically)
 * @param {UniqueComponentRenderFn<Props>} renderFn
 *   Function that receives reactive props as a Cell and returns a template.
 *   Props updates propagate reactively through the Cell.
 *
 * @returns {UniqueComponent<Props>}
 *   A component function that accepts props including an optional `id` string.
 *   When `id` is omitted, a single instance is created per renderFn.
 *   When `id` is provided, separate instances are created for each unique id.
 */
export function createUnique(renderFn) {
  /** @param {UniqueProps<Props>} nextProps */
  const UniqueComponent = (nextProps) => {
    const { globalData, renderer } = getGlobalContext();
    if (!renderer) throw new Error('No renderer available');

    const awaitCtx = useAwait();
    const { host } = renderer;
    const key = nextProps.id ?? renderFn;

    let stash = globalData.get(StashSymbol);
    if (!stash) globalData.set(StashSymbol, (stash = new WeakMap()));

    let instances = stash.get(renderer);
    if (!instances) stash.set(renderer, (instances = new Map()));

    let instance = instances.get(key);
    const isFirstRender = !instance;

    /** @type {any} */
    let group;
    /** @type {any} */
    let handle;

    if (!instance) {
      const props = Cell.source(nextProps);
      const state = branchState();
      const moveFns = new Set();
      const output = withState(state, () =>
        UniqueScope.Provider({
          value: moveFns,
          children: () => renderFn(props),
        })
      );

      group = createGroupFromNodes(output, renderer);
      handle = renderer.createGroupHandle(group);

      instance = {
        props,
        state,
        moveFns,
        restoreFns: [],
        journey: [handle],
        activeHandle: handle,
        teardown: null,
        isStable: false,
      };
      instances.set(key, instance);

      host.addEventListener(
        'retend:activate',
        () => (instance.isStable = true),
        { once: true }
      );
    } else {
      group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      instance.journey.push(handle);

      const moveToNewPosition = () => {
        if (instance.activeHandle === handle) return;

        if (instance.teardown) {
          host.removeEventListener('retend:activate', instance.teardown);
          instance.teardown = null;
          instance.state.node.enable();
        }

        if (
          instance.journey.includes(instance.activeHandle) &&
          instance.isStable
        ) {
          save(instance);
        }

        renderer.transfer(instance.activeHandle, handle);
        instance.activeHandle = handle;
        restore(instance);
      };

      if (awaitCtx && !awaitCtx.done) awaitCtx.finished.then(moveToNewPosition);
      else moveToNewPosition();
      instance.props.set(nextProps);
    }

    onSetup(() => {
      if (isFirstRender) instance.state.node.activate();
      else restore(instance);

      return () => {
        if (__HMR_SYMBOLS.getHMRContext()?.current) {
          return dispose(instance, instances, key);
        }

        const index = instance.journey.indexOf(handle);
        if (index !== -1) instance.journey.splice(index, 1);

        if (instance.activeHandle !== handle) return;

        instance.state.node.disable();
        if (instance.isStable) save(instance);

        const teardown = () => {
          if (instance.teardown !== teardown) return;
          instance.teardown = null;

          const newHead = instance.journey[instance.journey.length - 1];
          if (newHead) {
            renderer.transfer(handle, newHead);
            instance.activeHandle = newHead;
            instance.state.node.enable();
            restore(instance);
          } else {
            dispose(instance, instances, key);
          }
        };

        instance.teardown = teardown;
        host.addEventListener('retend:activate', teardown, { once: true });
      };
    });

    return group;
  };

  UniqueComponent.__retendUnique = true;
  const name = renderFn.name || 'Unique.Content';
  Object.defineProperty(UniqueComponent, 'name', { value: name });
  if (!renderFn.name) Object.defineProperty(renderFn, 'name', { value: name });

  return UniqueComponent;
}

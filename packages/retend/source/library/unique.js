/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { StateSnapshot, Scope } from '../library/scope.js' */

import { Cell } from '@adbl/cells';

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
import { linkNodes } from './index.js';

const StashSymbol = Symbol('UniqueStash');
/** @type {Scope<Set<UniqueMoveFn>>} */
const UniqueScope = createScope('Unique');

/**
 * @typedef {WeakMap<object, Map<string | Function, UniqueCtx>>} RendererUniqueStash
 */

/**
 * @typedef UniqueCtx
 * @property {SourceCell<UniqueProps<any>>} propsCell
 * @property {StateSnapshot} state
 * @property {Set<UniqueMoveFn>} moveFns
 * @property {Array<() => void>} restoreFns
 * @property {any} handle
 * @property {any[]} handles
 * @property {(() => void) | null} teardown
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
 * @example
 * const UniqueCounter = createUnique((props) => {
 *   const count = Cell.source(0);
 *   const increment = () => count.set(count.get() + 1);
 *   return (
 *     <div>
 *       <button onClick={increment}>Count: {count}</button>
 *     </div>
 *   );
 * });
 *
 * // Renders the same instance regardless of where it appears
 * <UniqueCounter />
 *
 * @example
 * // With id - multiple instances distinguished by id prop
 * const UniqueVideoPlayer = createUnique((props) => {
 *   const src = Cell.derived(() => props.get().src);
 *   return <video src={src} controls />;
 * });
 *
 * // Each id creates a separate persistent instance
 * <UniqueVideoPlayer id="main" src="/video1.mp4" />
 * <UniqueVideoPlayer id="pip" src="/video2.mp4" />
 *
 * @example
 * // With custom state management
 * const UniqueCanvas = createUnique((props) => {
 *   const canvas = Cell.source(null);
 *
 *   onSetup(() => {
 *     const node = canvas.get();
 *     if (!node) return;
 *     // Initialize canvas context, listeners, etc.
 *     const ctx = node.getContext('2d');
 *     // ... setup
 *   });
 *
 *   return <canvas ref={canvas} />;
 * });
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
  /** @param {UniqueProps<Props>} props */
  const UniqueComponent = (props) => {
    const { globalData, renderer } = getGlobalContext();
    if (!renderer) throw new Error('No renderer available');
    const awaitCtx = useAwait();
    const deferTransfer = Boolean(awaitCtx && !awaitCtx.done);
    let group;
    /** @type {any} */
    let handle;

    /** @type {RendererUniqueStash} */
    let stash = globalData.get(StashSymbol);
    if (!stash) {
      stash = new WeakMap();
      globalData.set(StashSymbol, stash);
    }

    let instances = stash.get(renderer);
    if (!instances) {
      instances = new Map();
      stash.set(renderer, instances);
    }

    const key = props.id ?? renderFn; // todo: we need a better way to prevent collisions if multiple components share an id namespace.
    let instance = instances.get(key);
    if (!instance) {
      // Create the persistent instance once, then keep moving its live handle.
      const propsCell = Cell.source(props);
      const state = branchState();
      /** @type {Set<UniqueMoveFn>} */
      const moveFns = new Set();
      const output = withState(state, () => {
        return UniqueScope.Provider({
          value: moveFns,
          children: () => renderFn(propsCell),
        });
      });
      state.node.disable(); // Prevents detachment of the parent scope from affecting this.
      group = renderer.createGroup();
      linkNodes(group, output, renderer);
      handle = renderer.createGroupHandle(group);

      instance = {
        propsCell,
        state,
        moveFns,
        restoreFns: [],
        handle,
        handles: [],
        teardown: null,
      };
      instances.set(key, instance);
    } else {
      if (instance.teardown && !deferTransfer) {
        renderer.host.removeEventListener('retend:activate', instance.teardown);
        instance.teardown = null;
      }
      group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      if (!deferTransfer) {
        renderer.transfer(instance.handle, handle);
        instance.handle = handle;
      } else if (awaitCtx) {
        const current = instance;
        awaitCtx.finished.then(() => {
          if (instances.get(key) !== current) return;
          if (current.handle === handle) return;
          if (!renderer.isActive(handle[0])) return;
          if (current.teardown) {
            renderer.host.removeEventListener(
              'retend:activate',
              current.teardown
            );
            current.teardown = null;
          }
          renderer.transfer(current.handle, handle);
          current.handle = handle;
        });
      }
    }

    instance.propsCell.set(props);

    onSetup(() => {
      if (!instance.handles.includes(handle)) {
        instance.handles.push(handle);
      }
      if (instance.handle === handle) {
        instance.state.node.enable();
        if (instance.restoreFns.length) {
          withState(instance.state, () => {
            for (const restore of instance.restoreFns) {
              restore();
            }
          });
          instance.restoreFns.length = 0;
        }
      }
      instance.state.node.activate();

      return () => {
        const index = instance.handles.indexOf(handle);
        if (index !== -1) {
          instance.handles.splice(index, 1);
        }
        if (instance.handle !== handle) return;

        const hmrContext = __HMR_SYMBOLS.getHMRContext();
        if (hmrContext?.current) {
          instance.state.node.enable();
          instance.state.node.dispose();
          instances.delete(key);
          return;
        }

        instance.state.node.disable();
        instance.restoreFns.length = 0;
        withState(instance.state, () => {
          for (const callback of instance.moveFns) {
            const restore = callback();
            if (typeof restore === 'function') {
              instance.restoreFns.push(restore);
            }
          }
        });

        const parkedGroup = renderer.createGroup();
        const parkedHandle = renderer.createGroupHandle(parkedGroup);
        renderer.transfer(handle, parkedHandle);
        instance.handle = parkedHandle;

        const nextHandle = instance.handles.at(-1);
        if (nextHandle) {
          renderer.transfer(parkedHandle, nextHandle);
          instance.handle = nextHandle;
          instance.state.node.enable();
          if (instance.restoreFns.length) {
            withState(instance.state, () => {
              for (const restore of instance.restoreFns) {
                restore();
              }
            });
            instance.restoreFns.length = 0;
          }
          return;
        }

        const teardown = () => {
          if (instance.teardown !== teardown) return;
          instance.teardown = null;
          instance.state.node.enable();
          instance.state.node.dispose();
          instances.delete(key);
        };

        instance.teardown = teardown;
        renderer.host.addEventListener('retend:activate', teardown, {
          once: true,
        });
      };
    });

    return group;
  };

  UniqueComponent.__retendUnique = true;
  Object.defineProperty(UniqueComponent, 'name', { value: renderFn.name });
  if (!renderFn.name) {
    Object.defineProperty(renderFn, 'name', { value: 'Unique.Content' });
  }
  return UniqueComponent;
}

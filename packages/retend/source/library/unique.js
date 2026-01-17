/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { ScopeSnapshot } from '../library/scope.js'; */
/** @import { Renderer } from '../library/renderer.js'; */

import { Cell, SourceCell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import h from '../library/jsx.js';
import { getGlobalContext } from '../context/index.js';
import {
  __HMR_SYMBOLS,
  createScopeSnapshot,
  useSetupEffect,
  withScopeSnapshot,
} from '../library/scope.js';
import { getActiveRenderer } from '../library/renderer.js';
import { linkNodes } from '../library/utils.js';

/**
 * @typedef UniqueStash
 * @property {Map<string | Function, { data: any }>} instances
 * @property {Map<string | Function, Cell<unknown | null>>} refs
 * @property {Map<string | Function, ScopeSnapshot>} scopes
 * @property {Map<string | Function, SourceCell<any>>} props
 * @property {Set<() => void>} pendingTeardowns
 * @property {Map<string | Function, unknown[]>} stack
 * @property {() => void} onActivate
 */

/**
 * @typedef {WeakMap<Renderer<any>, UniqueStash>} RendererToUniqueStash
 */

const UniqueComponentStash = Symbol('UniqueComponentStash');
const elementName = 'retend-unique-instance';

/**
 * @param {Renderer<any>} renderer
 * @returns {UniqueStash}
 */
const initUniqueStash = (renderer) => {
  const { globalData } = getGlobalContext();
  const checkForUniqueComponentTeardowns = () => {
    for (const teardown of stash.pendingTeardowns) {
      teardown();
    }
    stash.pendingTeardowns.clear();
  };

  const stash = {
    instances: new Map(),
    refs: new Map(),
    scopes: new Map(),
    pendingTeardowns: new Set(),
    stack: new Map(),
    props: new Map(),
    onActivate: checkForUniqueComponentTeardowns,
  };
  const rendererStash = new Map();
  rendererStash.set(renderer, stash);
  globalData.set(UniqueComponentStash, rendererStash);

  renderer.host.addEventListener('retend:activate', stash.onActivate);
  return stash;
};

/**
 * @template Data, Node
 * @typedef {Object} UniqueComponentOptions
 * @property {(node: Node) => Data} [onSave]
 * @property {(node: Node, data: Data) => void} [onRestore]
 * @property {JSX.BaseContainerProps} [container]
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
 * - Custom data managed via `onSave` / `onRestore` callbacks (if used)
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
 * const UniqueCanvas = createUnique(
 *   (props) => {
 *     const canvas = Cell.source(null);
 *     useSetupEffect(() => {
 *       const node = canvas.get();
 *       if (!node) return;
 *       // Initialize canvas context, listeners, etc.
 *       const ctx = node.getContext('2d');
 *       // ... setup
 *     });
 *     return <canvas ref={canvas} />;
 *   },
 *   {
 *     onSave: (node) => {
 *       // Extract custom state before component moves
 *       return { customState: extractState(node) };
 *     },
 *     onRestore: (node, data) => {
 *       // Restore custom state after component moves
 *       applyState(node, data.customState);
 *     }
 *   }
 * );
 *
 * @template {{}} Props - Props type (excluding id, which is added automatically)
 * @template [Data=any] - Type of custom data managed by onSave/onRestore
 * @template [Node=unknown] - Type of the root node (environment-specific)
 *
 * @param {UniqueComponentRenderFn<Props>} renderFn
 *   Function that receives reactive props as a Cell and returns a template.
 *   Props updates propagate reactively through the Cell.
 *
 * @param {UniqueComponentOptions<Data, Node>} [options]
 *
 * @returns {UniqueComponent<Props>}
 *   A component function that accepts props including an optional `id` string.
 *   When `id` is omitted, a single instance is created per renderFn.
 *   When `id` is provided, separate instances are created for each unique id.
 */
export function createUnique(renderFn, options = {}) {
  /** @param {UniqueProps<Props>} props */
  const UniqueComponent = (props) => {
    const { id = renderFn } = props;
    const { globalData } = getGlobalContext();
    const renderer = getActiveRenderer();
    const hArgs = /** @type {const} */ ([
      undefined,
      undefined,
      undefined,
      undefined,
      renderer,
    ]);
    const { onSave, onRestore, container = {} } = options;
    const ref = Cell.source(null);

    /** @type {UniqueStash} */
    const stash =
      globalData.get(UniqueComponentStash)?.get(renderer) ??
      initUniqueStash(renderer);
    let journey = stash.stack.get(id);
    if (!journey) {
      journey = [];
      stash.stack.set(id, journey);
    }
    let propSource = stash.props.get(id);
    if (!propSource) {
      propSource = Cell.source(props);
      stash.props.set(id, propSource);
    } else {
      propSource.set(props);
    }
    const observer = useObserver();

    const retendUniqueInstance = h(elementName, container, ...hArgs);
    let previous = stash.instances.get(id);

    /** @param {unknown} div */
    const saveState = (div) => {
      renderer.setProperty(div, 'state', 'moved');
      let customData;
      // @ts-ignore: TODO: The base type should be unknown when more environments are added.
      if (onSave && renderer.isActive(div)) customData = onSave(div);

      previous = renderer.saveContainerState(div, customData);
      if (previous) stash.instances.set(id, previous);
    };

    /** @param {unknown} div */
    const restoreState = (div) => {
      if (onRestore && previous?.data) {
        // @ts-ignore: TODO: The base type should be unknown when more environments are added.
        onRestore(div, previous.data);
      }

      stash.refs.set(id, Cell.source(div));
      if (!journey.includes(div)) journey.push(div);
      stash.instances.delete(id);
    };

    if (!previous) {
      const div = stash.refs.get(id)?.peek();
      if (div) saveState(div);
    }
    let disposedByHMR = false;

    // it's tricky to know when to dispose,
    // because if this instance is removed, but then rendered somewhere else
    // in the very next frame, we want both instances consolidated.
    //
    // Retend's lifecycle is:
    // -> control flow component triggers change
    // -> its current setup effects are disposed (we save state here)
    // -> its dom nodes are removed
    // -> its observer cleanups are called (we add event listener here)
    // -> new component is rendered (we transfer nodes here)
    // -> wait till next event loop (in activate fn)
    // -> new setup effect is activated.
    // -> retend:activate event dispatched.
    // Once (7) runs, it means the next node should already be in the dom, and if
    // it isn't, then we can dispose, because there is no continuity.
    const teardown = () => {
      const possibleNextInstance = journey.at(-1);
      if (possibleNextInstance) {
        stash.pendingTeardowns.delete(teardown);
        return;
      }
      const scope = stash.scopes.get(id);
      if (scope) {
        scope.node.enable();
        scope.node.dispose();
      }
      stash.instances.delete(id);
      stash.refs.delete(id);
      stash.scopes.delete(id);
      stash.stack.delete(id);
      stash.props.delete(id);
      stash.pendingTeardowns.delete(teardown);
    };

    observer.onConnected(ref, (div) => {
      restoreState(div);
      const scope = stash.scopes.get(id);
      if (scope) scope.node.enable();

      return () => {
        const index = journey.indexOf(div);
        if (index !== -1) journey.splice(index, 1);
        const nextInstance = journey.at(-1);
        if (!nextInstance && !disposedByHMR)
          stash.pendingTeardowns.add(teardown);
      };
    });

    useSetupEffect(() => {
      const current = ref.peek();

      return () => {
        // We dont want to preserve the instance across HMR re-renders.
        const hmrContext = __HMR_SYMBOLS.getHMRContext();
        if (hmrContext?.current) {
          const scope = stash.scopes.get(id);
          if (scope) {
            scope.node.enable();
            scope.node.dispose();
          }
          stash.instances.delete(id);
          stash.refs.delete(id);
          stash.scopes.delete(id);
          disposedByHMR = true;
          return;
        }
        const scope = stash.scopes.get(id);
        if (scope) scope.node.disable();
        const currentElement = stash.refs.get(id)?.peek();

        const index = journey.indexOf(currentElement);
        if (index !== -1) journey.splice(index, 1);

        if (currentElement === current) {
          saveState(current);

          const next = journey.at(-1);
          if (next && currentElement !== next) {
            renderer.append(next, Array.from(retendUniqueInstance.childNodes));
            renderer.setProperty(next, 'state', 'restored');
            restoreState(next);
          }
        }
      };
    });

    if (ref instanceof SourceCell) ref.set(retendUniqueInstance);
    stash.refs.set(id, ref);

    let childNodes;
    if (previous) {
      renderer.setProperty(retendUniqueInstance, 'state', 'restored');
      renderer.restoreContainerState(retendUniqueInstance, previous);
    } else {
      renderer.setProperty(retendUniqueInstance, 'state', 'new');
      childNodes = (() => {
        const scopeSnapshot = createScopeSnapshot();
        stash.scopes.set(id, scopeSnapshot);
        return withScopeSnapshot(scopeSnapshot, () =>
          h(renderFn, propSource, ...hArgs)
        );
      })();
      linkNodes(retendUniqueInstance, childNodes, renderer);
    }

    return retendUniqueInstance;
  };
  return UniqueComponent;
}

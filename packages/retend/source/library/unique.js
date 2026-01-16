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
 * @property {Map<string, { data: any }>} instances
 * @property {Map<string, Cell<unknown | null>>} refs
 * @property {Map<string, ScopeSnapshot>} scopes
 * @property {Set<() => void>} pendingTeardowns
 * @property {Map<string, unknown[]>} stack
 * @property {() => void} onActivate
 */

/**
 * @typedef {WeakMap<Renderer<any>, UniqueStash>} RendererToUniqueStash
 */

// /**
//  * @typedef SavedElementInstance
//  * @property {ChildNode[]} children
//  * @property {ShadowRoot | null} shadowRoot
//  * @property {any} [data]
//  */

/**
 * @template Data
 * @typedef UniqueSpecificProps
 * @property {string} name
 *   A unique identifier for this element. Elements with the same name across different
 *   parts of the component tree will be treated as the same logical element.
 *
 *   When a Unique component with this name unmounts and another with the same name mounts,
 *   the DOM nodes will be preserved and animated between positions.
 * @property {() => JSX.Template} children
 *   A function that returns the content to render. Must be a function to ensure proper
 *   re-evaluation when the component moves.
 *
 *   The JSX content to render inside the unique container
 * @property {Cell<HTMLElement | null>} [ref]
 *   Optional Cell reference to the underlying DOM element.
 *   If not provided, one will be created automatically.
 *
 * @property {(element: HTMLElement) => Data} [onSave]
 *   Called when the element is about to unmount, allowing you to save additional state.
 *
 * @property {(element: HTMLElement, data: Data) => void} [onRestore]
 *   Called when the element is being restored at a new location.
 */

/**
 * Props for the Unique component.
 * @template CustomData
 * @typedef {JSX.BaseContainerProps & UniqueSpecificProps<CustomData>} UniqueProps
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
    onActivate: checkForUniqueComponentTeardowns,
  };
  const rendererStash = new Map();
  rendererStash.set(renderer, stash);
  globalData.set(UniqueComponentStash, rendererStash);

  renderer.host.addEventListener('retend:activate', stash.onActivate);
  return stash;
};

/**
 * @template Data
 * @param {UniqueProps<Data>} props
 * @returns {JSX.Template}
 *
 * Ensures only one instance of a component exists across your entire application,
 * identified by its `name`. Even if the same `name` appears in different parts of the tree,
 * it is only rendered once, and the DOM nodes are transferred to the final location
 * instead of being recreated. Setup effects within the component only run once when first created,
 * and continue until every instance of the component is unmounted.
 *
 * @example
 * function PersistentVideo({ src, name }) {
 *   return (
 *     <Unique name={name}>
 *       {() => <VideoPlayer src={src} />}
 *     </Unique>
 *   );
 * }
 *
 * function App() {
 *   const page = Cell.source('home');
 *
 *   return (
 *     <div>
 *       {Switch(page, {
 *         home: () => <HomePage><PersistentVideo name="main-video" src="intro.mp4" /></HomePage>,
 *         about: () => <AboutPage><PersistentVideo name="main-video" src="intro.mp4" /></AboutPage>
 *       })}
 *     </div>
 *   );
 * }
 *
 * @example
 * function PersistentScrollArea({ children, name }) {
 *   return (
 *     <Unique
 *       name={name}
 *       onSave={(el) => ({ scrollTop: el.scrollTop })}
 *       onRestore={(el, data) => { el.scrollTop = data.scrollTop; }}
 *     >
 *       {() => <div style="height: 400px; overflow: auto">{children}</div>}
 *     </Unique>
 *   );
 * }
 *
 * @example
 * function PersistentBookCard({ book }) {
 *   return (
 *     <Unique name={`book-${book.id}`}>
 *       {() => (
 *         <div class="book-card">
 *           <h3>{book.title}</h3>
 *           <VideoPlayer src={book.trailerUrl} />
 *         </div>
 *       )}
 *     </Unique>
 *   );
 * }
 *
 * {For(books, (book) => <PersistentBookCard book={book} />)}
 */
export function Unique(props) {
  const { globalData } = getGlobalContext();
  const renderer = getActiveRenderer();
  const hArgs = /** @type {const} */ ([
    undefined,
    undefined,
    undefined,
    undefined,
    renderer,
  ]);
  const {
    name,
    children,
    ref = Cell.source(null),
    onSave,
    onRestore,
    ...rest
  } = props;

  /** @type {UniqueStash} */
  const stash =
    globalData.get(UniqueComponentStash)?.get(renderer) ??
    initUniqueStash(renderer);
  let journey = stash.stack.get(name);
  if (!journey) {
    journey = [];
    stash.stack.set(name, journey);
  }
  const observer = useObserver();

  const retendUniqueInstance = h(elementName, rest, ...hArgs);
  let previous = stash.instances.get(name);

  /** @param {unknown} div */
  const saveState = (div) => {
    renderer.setProperty(div, 'state', 'moved');
    let customData;
    // @ts-ignore: TODO: The base type should be unknown when more environments are added.
    if (onSave) customData = onSave(div);

    previous = renderer.saveContainerState(div, customData);
    if (previous) stash.instances.set(name, previous);
  };

  /** @param {unknown} div */
  const restoreState = (div) => {
    if (onRestore && previous) {
      // @ts-ignore: TODO: The base type should be unknown when more environments are added.
      onRestore(div, previous.data);
    }

    stash.refs.set(name, Cell.source(div));
    if (!journey.includes(div)) journey.push(div);
    stash.instances.delete(name);
  };

  if (!previous) {
    const div = stash.refs.get(name)?.peek();
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
    const scope = stash.scopes.get(name);
    if (scope) {
      scope.node.enable();
      scope.node.dispose();
    }
    stash.instances.delete(name);
    stash.refs.delete(name);
    stash.scopes.delete(name);
    stash.stack.delete(name);
    stash.pendingTeardowns.delete(teardown);
  };

  observer.onConnected(ref, (div) => {
    restoreState(div);
    const scope = stash.scopes.get(name);
    if (scope) scope.node.enable();

    return () => {
      journey.splice(journey.indexOf(div), 1);
      const nextInstance = journey.at(-1);
      if (!nextInstance && !disposedByHMR) stash.pendingTeardowns.add(teardown);
    };
  });

  useSetupEffect(() => {
    const current = ref.peek();

    return () => {
      // We dont want to preserve the instance across HMR re-renders.
      const hmrContext = __HMR_SYMBOLS.getHMRContext();
      if (hmrContext?.current) {
        const scope = stash.scopes.get(name);
        if (scope) {
          scope.node.enable();
          scope.node.dispose();
        }
        stash.instances.delete(name);
        stash.refs.delete(name);
        stash.scopes.delete(name);
        disposedByHMR = true;
        return;
      }
      const scope = stash.scopes.get(name);
      if (scope) scope.node.disable();
      const currentElement = stash.refs.get(name)?.peek();
      journey.splice(journey.indexOf(currentElement), 1);
      if (currentElement === current) {
        saveState(/** @type {HTMLElement} */ (current));

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
  stash.refs.set(name, ref);

  renderer.setProperty(retendUniqueInstance, 'name', name);
  let childNodes;
  if (previous) {
    renderer.setProperty(retendUniqueInstance, 'state', 'restored');
    renderer.restoreContainerState(retendUniqueInstance, previous);
  } else {
    renderer.setProperty(retendUniqueInstance, 'state', 'new');
    childNodes = (() => {
      const scopeSnapshot = createScopeSnapshot();
      stash.scopes.set(name, scopeSnapshot);
      return withScopeSnapshot(scopeSnapshot, () => h(children, {}, ...hArgs));
    })();
    linkNodes(retendUniqueInstance, childNodes, renderer);
  }

  return retendUniqueInstance;
}

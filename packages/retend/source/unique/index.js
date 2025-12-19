/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { VElement } from '../v-dom/index.js'; */
/** @import { ScopeSnapshot } from '../library/scope.js'; */
/** @import { GlobalContextChangeEvent } from '../context/index.js'; */

import { Cell, SourceCell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import h from '../library/jsx.js';
import { getGlobalContext } from '../context/index.js';
import {
  createScopeSnapshot,
  useSetupEffect,
  withScopeSnapshot,
} from '../library/scope.js';
import { getHMRContext } from '../library/hmr.js';
import { writeStaticStyle } from '../library/utils.js';
import { getActiveRenderer, appendChild } from '../renderers/index.js';

/**
 * @typedef UniqueStash
 * @property {Map<string, SavedElementInstance>} instances
 * @property {Map<string, Cell<HTMLElement | null>>} refs
 * @property {Map<string, ScopeSnapshot>} scopes
 * @property {Set<() => void>} pendingTeardowns
 * @property {() => void} onActivate
 */

/**
 * @typedef SavedElementInstance
 * @property {ChildNode[]} children
 * @property {ShadowRoot | null} shadowRoot
 * @property {any} [data]
 */

/** @typedef {JSX.IntrinsicElements["div"]} DivProps */

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
 * @typedef {DivProps & UniqueSpecificProps<CustomData>} UniqueProps
 */

const UniqueComponentStash = Symbol('UniqueComponentStash');
const elementName = 'retend-unique-instance';

/**
 * @returns {UniqueStash}
 */
const initUniqueStash = () => {
  const { window, globalData } = getGlobalContext();
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
    onActivate: checkForUniqueComponentTeardowns,
  };
  globalData.set(UniqueComponentStash, stash);

  window.addEventListener('retend:activate', stash.onActivate);
  window.addEventListener('globalcontextchange', (event) => {
    const _event = /** @type {GlobalContextChangeEvent} */ (event);
    const { newContext } = _event.detail;
    window.removeEventListener('retend:activate', stash.onActivate);
    if (!newContext) return;
    const { window: newWindow } = newContext;

    if (stash.pendingTeardowns.size > 0) {
      newWindow.addEventListener('retend:activate', stash.onActivate);
    }
  });
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
  const {
    name,
    children,
    ref = Cell.source(null),
    onSave,
    onRestore,
    ...rest
  } = props;

  /** @type {UniqueStash} */
  const stash = globalData.get(UniqueComponentStash) ?? initUniqueStash();
  const selector = `${elementName}[name="${name}"]`;
  const observer = useObserver();

  writeStaticStyle(
    'retend-unique-instance-style',
    ':where(retend-unique-instance) {display: block;width:fit-content;height:fit-content}'
  );

  const retendUniqueInstance = h(elementName, rest);
  let previous = stash.instances.get(name);

  /** @param {HTMLElement | VElement} div */
  const saveState = (div) => {
    const children = /** @type {ChildNode[]} */ ([...div.childNodes]);
    const shadowRoot = /** @type {ShadowRoot | null} */ (div.shadowRoot);
    div.setAttribute('state', 'moved');
    previous = { children, shadowRoot };

    if (onSave) {
      const _div = /** @type {HTMLElement} */ (div);
      const customData = onSave(_div);
      previous.data = customData;
    }

    if (previous) stash.instances.set(name, previous);
  };

  /** @param {HTMLElement} div */
  const restoreState = (div) => {
    if (onRestore && previous) {
      onRestore(div, previous.data);
    }

    stash.refs.set(name, Cell.source(div));
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
    const { window } = getGlobalContext();
    const possibleNextInstance = window.document.querySelector(selector);
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
    stash.pendingTeardowns.delete(teardown);
  };

  observer.onConnected(ref, (div) => {
    restoreState(div);
    const scope = stash.scopes.get(name);
    if (scope) scope.node.enable();

    return () => {
      const { window } = getGlobalContext();
      const nextInstance = window.document.querySelector(selector);
      if (!nextInstance && !disposedByHMR) stash.pendingTeardowns.add(teardown);
    };
  });

  useSetupEffect(() => {
    const current = ref.peek();

    return () => {
      // We dont want to preserve the instance across HMR re-renders.
      const hmrContext = getHMRContext();
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

      const { window } = getGlobalContext();
      const renderer = getActiveRenderer();
      const scope = stash.scopes.get(name);
      if (scope) scope.node.disable();
      const currentElement = stash.refs.get(name)?.peek();
      if (currentElement === current) {
        saveState(/** @type {HTMLElement} */ (current));

        const nextInstances = window.document.querySelectorAll(selector);
        for (const nextInstance of [...nextInstances].reverse()) {
          if (currentElement !== nextInstance) {
            renderer.append(
              nextInstance,
              Array.from(retendUniqueInstance.childNodes)
            );
            nextInstance.setAttribute('state', 'restored');
            // @ts-expect-error
            restoreState(nextInstance);
            break;
          }
        }
      }
    };
  });

  if (ref instanceof SourceCell) ref.set(retendUniqueInstance);
  stash.refs.set(name, ref);
  retendUniqueInstance.setAttribute('name', name);

  let childNodes;
  let shadowRoot;
  if (previous?.children) {
    childNodes = previous.children;
    shadowRoot = previous.shadowRoot;
  } else {
    childNodes = (() => {
      const scopeSnapshot = createScopeSnapshot();
      stash.scopes.set(name, scopeSnapshot);
      return withScopeSnapshot(scopeSnapshot, () => h(children, {}));
    })();
  }

  retendUniqueInstance.setAttribute('state', previous ? 'restored' : 'new');
  appendChild(retendUniqueInstance, childNodes, renderer);

  if (shadowRoot) {
    const { mode, childNodes } = shadowRoot;
    const newShadowRoot = retendUniqueInstance.attachShadow({ mode });
    appendChild(newShadowRoot, childNodes, renderer);
  }

  return retendUniqueInstance;
}

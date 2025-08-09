import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

const USE_DOCUMENT_VISIBILITY_KEY = Symbol(
  'hooks:useDocumentVisibility:visibilityCache'
);

/**
 * Tracks the document's visibility state and provides a reactive cell.
 *
 * @returns {Cell<DocumentVisibilityState>} A derived cell containing the document's visibility state.
 *
 * @example
 * import { useDocumentVisibility } from 'retend-utils/hooks';
 *
 * const visibility = useDocumentVisibility();
 * console.log(`Current visibility state: ${visibility.get()}`);
 */
export const useDocumentVisibility = createGlobalStateHook({
  cacheKey: USE_DOCUMENT_VISIBILITY_KEY,

  createSource: () => ({
    visibilitySource: Cell.source(
      /** @type {DocumentVisibilityState} */ ('visible')
    ),
  }),

  initializeState: (window, cells) => {
    cells.visibilitySource.set(window.document.visibilityState);
  },

  setupListeners: (window, cells) => {
    window.document.addEventListener('visibilitychange', () => {
      cells.visibilitySource.set(window.document.visibilityState);
    });
  },

  createReturnValue: (cells) =>
    Cell.derived(() => cells.visibilitySource.get()),
});

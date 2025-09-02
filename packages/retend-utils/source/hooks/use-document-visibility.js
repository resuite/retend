import { Cell } from 'retend';
import { createSharedHook } from '../internal/create-shared-hook.js';

const USE_DOCUMENT_VISIBILITY_KEY = Symbol(
  'hooks:useDocumentVisibility:visibilityCache'
);

/**
 * Tracks the document's visibility state and provides a reactive cell.
 *
 * @type {() => Cell<DocumentVisibilityState>}
 * @returns {Cell<DocumentVisibilityState>} A derived cell containing the document's visibility state.
 *
 * @example
 * import { useDocumentVisibility } from 'retend-utils/hooks';
 *
 * const visibility = useDocumentVisibility();
 * console.log(`Current visibility state: ${visibility.get()}`);
 */
export const useDocumentVisibility = createSharedHook({
  key: USE_DOCUMENT_VISIBILITY_KEY,
  initialData: () => ({
    visibilitySource: Cell.source(document.visibilityState),
    count: 0,
  }),
  setup: (data, { document }) => {
    data.handleVisibilityChange = () => {
      data.visibilitySource.set(document.visibilityState);
    };
    document.addEventListener('visibilitychange', data.handleVisibilityChange);
  },
  teardown: (data, { document }) => {
    document.removeEventListener(
      'visibilitychange',
      data.handleVisibilityChange
    );
  },
  getValue: (data) => Cell.derived(() => data.visibilitySource.get()),
});

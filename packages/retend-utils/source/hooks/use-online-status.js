/** @import { SourceCell } from 'retend' */
/** @import { CreateGlobalStateHookOptions } from './_shared.js' */

import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

/**
 * @typedef {object} NetworkStatusState
 * @property {SourceCell<boolean>} isOnlineSource - The source cell holding the status.
 */

const USE_ONLINE_STATUS_KEY = Symbol('hooks:useOnlineStatus:statusCache');

/**
 * Tracks the network connection status and provides a reactive cell.
 *
 * @returns {Cell<boolean>} A derived cell containing the online status (true if online, false if offline).
 *
 * @example
 * import { useOnlineStatus } from 'retend-utils/hooks';
 *
 * const isOnline = useOnlineStatus();
 * console.log(`Currently online: ${isOnline.get()}`);
 */
export const useOnlineStatus = createGlobalStateHook(
  /** @type {CreateGlobalStateHookOptions<[], NetworkStatusState, Cell<boolean>>} */
  ({
    cacheKey: USE_ONLINE_STATUS_KEY,

    createSource: () => ({
      isOnlineSource: Cell.source(true),
    }),

    initializeState: (window, cells) => {
      cells.isOnlineSource.set(window.navigator.onLine);
    },

    setupListeners: (window, cells) => {
      window.addEventListener('online', () => {
        cells.isOnlineSource.set(true);
      });
      window.addEventListener('offline', () => {
        cells.isOnlineSource.set(false);
      });
    },

    createReturnValue: (cells) =>
      Cell.derived(() => cells.isOnlineSource.get()),
  })
);

import { Cell } from 'retend';
import { createSharedHook } from '../internal/create-shared-hook.js';

const USE_ONLINE_STATUS_KEY = Symbol('hooks:useOnlineStatus:statusCache');

/**
 * Tracks the network connection status and provides a reactive cell.
 *
 * @type {() => Cell<boolean>}
 * @returns {Cell<boolean>} A derived cell containing the online status (true if online, false if offline).
 *
 * @example
 * import { useOnlineStatus } from 'retend-utils/hooks';
 *
 * const isOnline = useOnlineStatus();
 * console.log(`Currently online: ${isOnline.get()}`);
 */
export const useOnlineStatus = createSharedHook({
  key: USE_ONLINE_STATUS_KEY,

  initialData: () => ({
    isOnlineSource: Cell.source(true),
  }),

  setup: (data, { window }) => {
    data.handleOnline = () => {
      data.isOnlineSource.set(true);
    };
    data.handleOffline = () => {
      data.isOnlineSource.set(false);
    };
    window.addEventListener('online', data.handleOnline);
    window.addEventListener('offline', data.handleOffline);
    data.isOnlineSource.set(window.navigator.onLine);
  },

  teardown: (data, { window }) => {
    window.removeEventListener('online', data.handleOnline);
    window.removeEventListener('offline', data.handleOffline);
  },

  getValue: (data) => Cell.derived(() => data.isOnlineSource.get()),
});

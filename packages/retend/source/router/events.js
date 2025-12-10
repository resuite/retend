/** @import { Router } from './router.js' */
/** @import { NavigationOptions } from './types.js'; */
import { CustomEvent } from '../context/index.js';

/**
 * @typedef {{
 *  'routechange': (this: Router, event: RouteChangeEvent) => void;
 *  'routelockprevented': (this: Router, event: RouteLockPreventedEvent) => void;
 *  'routeerror': (this: Router, event: RouteErrorEvent) => void;
 *  'beforenavigate': (this: Router, event: BeforeNavigateEvent) => void;
 *  'routeloadcompleted': (this: Router, event: RouteLoadCompletedEvent) => void;
 * }} RouterEventHandlerMap
 */

/**
 * @typedef {keyof RouterEventHandlerMap} RouterEventTypes
 */

/**
 * @typedef RouteChangeEventDetail
 *
 * @property {string | undefined} from
 * The path of the route that was leaving.
 *
 * @property {string} to
 * The path of the route that was entering.
 */

/**
 * @extends {CustomEvent<RouteChangeEventDetail>}
 */
export class RouteChangeEvent extends CustomEvent {
  /**
   * @param {RouteChangeEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('routechange', {
      cancelable: true,
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef RouteLockPreventedEventDetail
 *
 * @property {string} lockedPath
 * The path of the route that was locked.
 *
 * @property {string} attemptedPath
 * The path that navigation was attempted to, but prevented by the lock.
 */

/**
 * @extends {CustomEvent<RouteLockPreventedEventDetail>}
 */
export class RouteLockPreventedEvent extends CustomEvent {
  /** @param {RouteLockPreventedEventDetail} eventInitDict */
  constructor(eventInitDict) {
    super('routelockprevented', {
      cancelable: false, // Lock prevention is not cancelable
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef RouteErrorEventDetail
 *
 * @property {Error} error
 * The error object.
 */

/**
 * @extends {CustomEvent<RouteErrorEventDetail>}
 */
export class RouteErrorEvent extends CustomEvent {
  /**
   * @param {RouteErrorEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('routeerror', {
      cancelable: false,
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef BeforeNavigateEventDetail
 *
 * @property {string | undefined} from
 * The path of the route that was leaving.
 *
 * @property {string} to
 * The path of the route that was entering.
 */

/**
 * @extends {CustomEvent<BeforeNavigateEventDetail>}
 */
export class BeforeNavigateEvent extends CustomEvent {
  /**
   * @param {BeforeNavigateEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('beforenavigate', {
      cancelable: true,
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef RouteLoadCompletedEventDetail
 *
 * @property {string} fullPath
 * The path of the route that was loaded.
 *
 * @property {string} title
 * The title of the route that was loaded.
 *
 * @property {number} newHistoryLength
 * The new length of the history stack.
 *
 * @property {number} oldHistoryLength
 * The old length of the history stack.
 *
 * @property {boolean} replace
 * Whether the navigation should replace the current history entry.
 */

/**
 * @extends {CustomEvent<RouteLoadCompletedEventDetail>}
 */
export class RouteLoadCompletedEvent extends CustomEvent {
  /**
   * @param {RouteLoadCompletedEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('routeloadcompleted', {
      cancelable: false,
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef {NavigationOptions & { href: string }} RouterNavigationEventDetail
 */

/** @extends {CustomEvent<RouterNavigationEventDetail>} */
export class RouterNavigationEvent extends CustomEvent {}

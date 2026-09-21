/** @import { Router } from './router.js' */
/** @import { NavigationOptions } from './types.js'; */

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

export class RouteChangeEvent extends Event {
  /**
   * @param {string | undefined} from
   * @param {string} to
   */
  constructor(from, to) {
    super('routechange', { cancelable: true, bubbles: false });
    /**
     * The path of the route that was leaving.
     */
    this.from = from;
    /**
     * The path of the route that was entering.
     */
    this.to = to;
  }
}

export class RouteLockPreventedEvent extends Event {
  /**
   * @param {string} lockedPath
   * @param {string} attemptedPath
   */
  constructor(lockedPath, attemptedPath) {
    super('routelockprevented', { cancelable: false, bubbles: false }); // Lock prevention is not cancelable
    /**
     * The path of the route that was locked.
     */
    this.lockedPath = lockedPath;
    /**
     * The path that navigation was attempted to, but prevented by the lock.
     */
    this.attemptedPath = attemptedPath;
  }
}

export class RouteErrorEvent extends Event {
  /**
   * @param {Error} error
   */
  constructor(error) {
    super('routeerror', { cancelable: false, bubbles: false });
    /**
     * The error that occurred during route loading.
     */
    this.error = error;
  }
}

export class BeforeNavigateEvent extends Event {
  /**
   * @param {string | undefined} from
   * @param {string} to
   */
  constructor(from, to) {
    super('beforenavigate', { cancelable: true, bubbles: false });
    /**
     * The path of the route that was leaving.
     */
    this.from = from;
    /**
     * The path of the route that was entering.
     */
    this.to = to;
  }
}

/**
 * @typedef RouteLoadCompletedEventDetail
 *
 * @property {string} fullPath
 * @property {string} title
 * @property {number} newHistoryLength
 * @property {number} oldHistoryLength
 * @property {boolean} replace
 */

export class RouteLoadCompletedEvent extends Event {
  /**
   * @param {RouteLoadCompletedEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('routeloadcompleted', { cancelable: false, bubbles: false });
    /**
     * The path of the route that was loaded.
     */
    this.fullPath = eventInitDict.fullPath;
    /**
     * The title of the route that was loaded.
     */
    this.title = eventInitDict.title;
    /**
     * The new length of the history stack.
     */
    this.newHistoryLength = eventInitDict.newHistoryLength;
    /**
     * The old length of the history stack.
     */
    this.oldHistoryLength = eventInitDict.oldHistoryLength;
    /**
     * Whether the navigation should replace the current history entry.
     */
    this.replace = eventInitDict.replace;
  }
}

/**
 * @typedef {NavigationOptions & { href: string }} RouterNavigationEventDetail
 */

export class RouterNavigationEvent extends Event {
  /**
   * @param {'beforenavigate' | 'afternavigate'} type
   * @param {RouterNavigationEventDetail} eventInitDict
   */
  constructor(type, eventInitDict, cancelable = false) {
    super(type, { cancelable, bubbles: false });
    /**
     * The href of the navigation.
     */
    this.href = eventInitDict.href;
    /**
     * Whether the navigation should replace the current history entry.
     */
    this.replace = eventInitDict.replace;
  }
}

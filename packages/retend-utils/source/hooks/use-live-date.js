/** @import { SourceCell } from 'retend' */
/** @import { GlobalContextChangeEvent } from 'retend/context' */
import { Cell } from 'retend';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

const RUNNING_TIMERS_KEY = 'hooks:useLiveDate:timers';
const TRANSFER_SCHEDULED_KEY = 'hooks:useLiveDate:transferScheduled';

/**
 *
 * Tracks the current system date and time.
 *
 * @param {number} [interval] How often to update the date and time, in milliseconds.
 * Defaults to 1000 (1 second).
 *
 * @returns {Cell<Date>} A Cell containing the current date and time.
 *
 * @example
 * import { useLiveDate } from 'retend-utils/hooks';
 *
 * function MyClock() {
 *   const now = useLiveDate();
 *   const nowTimeStr = Cell.derived(() => now.value.toLocaleTimeString())
 *
 *   return (
 *     <div>
 *       The current time is: {nowTimeStr}
 *     </div>
 *   );
 * }
 */
export function useLiveDate(interval = 1000) {
  const { window, globalData } = getGlobalContext();

  /** @type {Map<number, SourceCell<Date>>} */
  let runningTimers = globalData.get(RUNNING_TIMERS_KEY);
  if (!runningTimers) {
    runningTimers = new Map();
    globalData.set(RUNNING_TIMERS_KEY, runningTimers);
  }

  let now = /** @type {SourceCell<Date>} */ (runningTimers.get(interval));
  if (!now) {
    now = Cell.source(new Date());
    window.setInterval(() => {
      now.value = new Date();
    }, interval);
    runningTimers.set(interval, now);

    if (matchContext(window, Modes.VDom)) {
      const transferScheduled = globalData.get(TRANSFER_SCHEDULED_KEY);
      if (transferScheduled) return now;

      /** @param {GlobalContextChangeEvent} event */
      const transferTimers = (event) => {
        const { newContext } = event.detail;
        if (
          newContext?.window &&
          matchContext(newContext.window, Modes.Interactive)
        ) {
          newContext.globalData.set(RUNNING_TIMERS_KEY, runningTimers);
          // @ts-ignore: Custom events are not properly typed in JS.
          window.removeEventListener('globalcontextchange', transferTimers);
        }
      };

      // @ts-ignore: Custom events are not properly typed in JS.
      window.addEventListener('globalcontextchange', transferTimers);
      globalData.set(TRANSFER_SCHEDULED_KEY, true);
    }
  }

  return now;
}

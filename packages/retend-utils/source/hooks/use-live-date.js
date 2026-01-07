/** @import { SourceCell } from 'retend' */
import { Cell, getActiveRenderer } from 'retend';
import { getGlobalContext } from 'retend/context';

const RUNNING_TIMERS_KEY = 'hooks:useLiveDate:timers';

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
 *   const nowTimeStr = Cell.derived(() => now.get().toLocaleTimeString())
 *
 *   return (
 *     <div>
 *       The current time is: {nowTimeStr}
 *     </div>
 *   );
 * }
 */
export function useLiveDate(interval = 1000) {
  const { globalData } = getGlobalContext();
  /** @type {{ host: Window }} */
  const renderer = getActiveRenderer();
  const { host: window } = renderer;

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
      now.set(new Date());
    }, interval);
    runningTimers.set(interval, now);
  }

  return now;
}

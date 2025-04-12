import { Cell } from 'retend';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

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
  const now = Cell.source(new Date());
  const { window } = getGlobalContext();

  // @ts-ignore: dependent on Vite.
  if (import.meta.env.SSR) {
    if (matchContext(window, Modes.VDom)) {
      window.setInterval(() => {
        now.value = new Date();
      }, interval);
    }
    return now;
  }

  setInterval(() => {
    now.value = new Date();
  }, interval);

  return now;
}

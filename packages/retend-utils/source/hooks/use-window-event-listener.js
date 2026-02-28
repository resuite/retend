import { getActiveRenderer, onSetup } from 'retend';
import { DOMRenderer } from 'retend-web';

/**
 * Adds an event listener to the window with automatic cleanup.
 *
 * @template {keyof WindowEventMap} K
 * @param {K} eventName - The name of the event to listen for.
 * @param {(event: WindowEventMap[K]) => void} eventCallback - The callback to run when the event is triggered.
 * @param {boolean | AddEventListenerOptions} [options] - Optional event listener options.
 *
 * @example
 * import { useWindowEventListener } from 'retend-utils/hooks';
 *
 * useWindowEventListener('resize', (event) => {
 *   console.log('Window resized!');
 * });
 *
 * // With options
 * useWindowEventListener('scroll', handleScroll, { passive: true });
 */
export const useWindowEventListener = (eventName, eventCallback, options) => {
  const renderer = getActiveRenderer();

  if (!(renderer instanceof DOMRenderer)) return;

  const { host: window } = renderer;

  window.addEventListener(eventName, eventCallback, options);

  onSetup(() => {
    return () => {
      window.removeEventListener(eventName, eventCallback, options);
    };
  });
};

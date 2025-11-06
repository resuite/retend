/** @import { JSX } from 'retend/jsx-runtime' */
/** @import { UniqueProps } from 'retend/unique'; */
import { Cell } from 'retend';
import { Unique } from 'retend/unique';

/**
 * @template CustomData
 * @typedef ElementUIState
 * @property {DOMRect} rect
 * @property {Animation[]} animations
 * @property {CustomData} [userData]
 */

/**
 * @typedef TransitionProps
 * @property {string} [transitionDuration] How long the transition between states should take.
 * @property {string} [transitionTimingFunction] How the transition should be performed.
 */

/**
 * @template CustomData
 * @typedef {UniqueProps<CustomData> & TransitionProps} UniqueTransitionProps
 */

/**
 * @param {DOMRect} from
 * @param {DOMRect} to
 */
function getInitialRelativeTransform(from, to) {
  const scaleX = from.width / to.width;
  const scaleY = from.height / to.height;

  const translateX = from.x - to.x;
  const translateY = from.y - to.y;

  return `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
}

const IS_DYNAMIC_CSS_EXPR = /(--)|(^calc\()/;

/**
 *
 * @param {string | undefined} transitionDuration
 * @param {string | undefined} transitionTimingFunction
 * @param {HTMLElement} element
 */
function parseTransitionOptions(
  transitionDuration,
  transitionTimingFunction,
  element
) {
  let duration = 0;
  let easing = transitionTimingFunction ?? 'ease';

  if (!transitionDuration) {
    return { duration, easing };
  }

  if (!transitionDuration.endsWith('s') || IS_DYNAMIC_CSS_EXPR.test(easing)) {
    const durationVar = '--unique-transition-duration';
    const easingVar = '--unique-transition-easing';

    // Allows us to dynamically resolve the duration, so
    // calc() or css vars can be passed in.
    element.style.setProperty(durationVar, transitionDuration);
    element.style.setProperty(easingVar, easing);

    const styles = getComputedStyle(element);
    const durationRaw = styles.getPropertyValue(durationVar);
    duration = durationRaw.endsWith('ms')
      ? Number(durationRaw.slice(0, -2))
      : Number(durationRaw.slice(0, -1)) * 1000;

    easing = styles.getPropertyValue(easingVar);
  } else {
    duration = transitionDuration.endsWith('ms')
      ? Number(transitionDuration.slice(0, -2))
      : Number(transitionDuration.slice(0, -1)) * 1000;
  }

  return { duration, easing };
}

/**
 * @template CustomData
 * @param {UniqueTransitionProps<CustomData>} props
 * @returns {UniqueProps<CustomData>}
 */
const addTransitionProps = (props) => {
  const {
    onSave,
    onRestore,
    style: styleProp,
    transitionDuration,
    transitionTimingFunction,
    ...rest
  } = props;

  /** @type {JSX.StyleValue} */
  const style = { transformOrigin: 'top left' };

  if (typeof styleProp === 'object' && !Cell.isCell(styleProp)) {
    Object.assign(style, styleProp);
  }

  return {
    ...rest,
    style,
    onSave(element) {
      const userData = onSave?.(element);
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) animation.pause();
      const rect = element.getBoundingClientRect();
      /** @type {ElementUIState<CustomData>} */
      const elementState = { rect, animations, userData };
      return /** @type {CustomData} */ (elementState);
    },

    onRestore(element, data) {
      const {
        rect: oldRect,
        animations: pausedAnimations,
        userData,
      } = /** @type {ElementUIState<CustomData>} */ (data);

      // @ts-expect-error: The type of user data is defined by user.
      onRestore?.(element, userData);
      if (oldRect.width === 0) return;
      for (const animation of pausedAnimations) animation.play();

      requestAnimationFrame(() => {
        const newRect = element.getBoundingClientRect();
        const initialTransform = getInitialRelativeTransform(oldRect, newRect);
        const options = parseTransitionOptions(
          transitionDuration,
          transitionTimingFunction,
          element
        );
        element.toggleAttribute('data-transitioning');
        /** @type {ElementInternals} */ // @ts-expect-error: is a custom element
        const internals = element.internals_;
        internals?.states?.add('--transitioning');

        element
          .animate({ transform: [initialTransform, 'none'] }, options)
          .finished.finally(() => {
            element.removeAttribute('data-transitioning');
            internals?.states?.delete('--transitioning');
          });
      });
    },
  };
};

/**
 * A wrapper around the Unique component that adds smooth FLIP animations when the element
 * moves between different positions in the DOM tree.
 *
 * When a UniqueTransition component with the same `name` unmounts and remounts elsewhere,
 * it automatically animates from its previous position/size to its new position/size using
 * CSS transforms and transitions.
 *
 * @template CustomData
 * @param {UniqueTransitionProps<CustomData>} props
 * @returns {JSX.Template}
 *
 * @example
 * // Video player that smoothly animates when moving between sidebar and main view
 * function PersistentVideo({ src, name }) {
 *   return (
 *     <UniqueTransition name={name} transitionDuration="300ms">
 *       {() => <VideoPlayer src={src} />}
 *     </UniqueTransition>
 *   );
 * }
 *
 * @example
 * // Card that animates between grid and detail view while preserving scroll position
 * function AnimatedCard({ item }) {
 *   return (
 *     <UniqueTransition
 *       name={`card-${item.id}`}
 *       onSave={(el) => ({ scrollTop: el.scrollTop })}
 *       onRestore={(el, data) => { el.scrollTop = data.scrollTop; }}
 *       transitionDuration=".3s"
 *     >
 *       {() => (
 *         <div class="card">
 *           <h3>{item.title}</h3>
 *           <div class="content">{item.content}</div>
 *         </div>
 *       )}
 *     </UniqueTransition>
 *   );
 * }
 *
 * @example
 * // Modal that animates from trigger button position
 * function AnimatedModal({ isOpen, children }) {
 *   return isOpen && (
 *     <UniqueTransition name="modal">
 *       {() => (
 *         <div class="modal-overlay">
 *           <div class="modal-content">{children}</div>
 *         </div>
 *       )}
 *     </UniqueTransition>
 *   );
 * }
 */
export function UniqueTransition(props) {
  return <Unique {...addTransitionProps(props)} />;
}

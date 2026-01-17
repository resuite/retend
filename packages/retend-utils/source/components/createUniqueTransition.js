/** @import { JSX } from 'retend/jsx-runtime' */
/** @import { UniqueComponent, UniqueComponentOptions, UniqueComponentRenderFn } from 'retend' */
import { Cell } from 'retend';
import { createUnique } from 'retend';

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
 * @property {boolean} [maintainWidthDuringTransition] If true, disables horizontal scaling during transitions.
 * @property {boolean} [maintainHeightDuringTransition] If true, disables vertical scaling during transitions.
 */

/**
 * @template CustomData
 * @typedef {UniqueComponentOptions<CustomData, HTMLElement> & TransitionProps} UniqueTransitionOptions
 */

/**
 * @param {DOMRect} from
 * @param {DOMRect} to
 * @param {object} [options]
 * @param {boolean} [options.maintainWidth]
 * @param {boolean} [options.maintainHeight]
 */
function getInitialRelativeTransform(from, to, options = {}) {
  const { maintainWidth = false, maintainHeight = false } = options;
  const scaleX = maintainWidth ? 1 : from.width / to.width;
  const scaleY = maintainHeight ? 1 : from.height / to.height;

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
 * @param {UniqueTransitionOptions<CustomData>} options
 * @returns {UniqueTransitionOptions<CustomData>}
 */
const addTransitionProps = (options) => {
  const {
    onSave,
    onRestore,
    container,
    transitionDuration,
    transitionTimingFunction,
    maintainWidthDuringTransition,
    maintainHeightDuringTransition,
    ...rest
  } = options;
  const { style: styleProp } = container ?? {};

  /** @type {JSX.StyleValue} */
  const style = { transformOrigin: 'top left' };

  if (typeof styleProp === 'object' && !Cell.isCell(styleProp)) {
    Object.assign(style, styleProp);
  }

  return {
    container: { ...rest, style },
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

      const options = parseTransitionOptions(
        transitionDuration,
        transitionTimingFunction,
        element
      );

      // Animations on ancestors of the target may modify the positioning
      // of the target element, making the bounding rect incorrect.
      // We need to recompute the new rect after all parent animations
      // have been scrubbed to the expected point on the document timeline.
      const { duration } = options;
      const parentAnimations = getAllParentAnimations(element);
      for (const animation of parentAnimations) {
        const currentTime = Number(animation.currentTime);
        animation.currentTime = currentTime + duration;
      }

      requestAnimationFrame(() => {
        const newRect = element.getBoundingClientRect();
        for (const animation of parentAnimations) {
          animation.currentTime = Number(animation.currentTime) - duration;
        }
        const parentTransform = getParentTransformMatrix(element);
        const isInvertible =
          Math.abs(
            parentTransform.a * parentTransform.d -
              parentTransform.b * parentTransform.c
          ) > 1e-10;

        const displacement = getInitialRelativeTransform(oldRect, newRect, {
          maintainWidth: maintainWidthDuringTransition,
          maintainHeight: maintainHeightDuringTransition,
        });
        const initialTransform = isInvertible
          ? `${parentTransform.inverse().toString()} ${displacement}`
          : displacement;
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
 * @param {Element} element
 */
function getAllParentAnimations(element) {
  const parentAnimations = [];

  let parent = element.parentElement;
  while (parent) {
    const animations = parent
      .getAnimations()
      .filter((animation) => animation.timeline instanceof DocumentTimeline);
    parentAnimations.push(...animations);
    parent = parent.parentElement;
  }

  return parentAnimations;
}

/**
 * Get the cumulative transform matrix from all parent elements
 * @param {Element} element
 */
function getParentTransformMatrix(element) {
  let parent = element.parentElement;
  let matrix = new DOMMatrix();

  while (parent) {
    const style = getComputedStyle(parent);
    const transform = style.transform;
    if (transform && transform !== 'none') {
      const parentMatrix = new DOMMatrix(transform);
      matrix = matrix.multiply(parentMatrix);
    }
    parent = parent.parentElement;
  }

  return matrix;
}

/**
 * Creates a unique component that visually transitions between locations
 * using a "First, Last, Invert, Play" (FLIP) strategy.
 *
 * This utility ensures that when a persistent component moves from one
 * container to another, the transition is seamless rather than an
 * instantaneous jump.
 *
 * ### Key Behaviors
 * - **Visual Continuity**: The component calculates its change in position
 * and scale (including parent transforms) and animates the difference.
 * - **Transition Styling**: The component container is marked with the
 * `data-transitioning` attribute and `--transitioning` state while the
 * animation is active.
 *
 * - The component must have an identifiable size (width/height > 0) in the
 * previous location for a transition to occur.
 * - To distinguish multiple instances of the same component type, provide
 * a unique `id` prop.
 *
 * @template {{}} Props
 * @template [CustomData=any]
 *
 * @param {UniqueComponentRenderFn<Props>} renderFn - The factory function
 * that defines the component's structure and reactivity.
 * @param {UniqueTransitionOptions<CustomData>} props - Configuration for
 * the transition timing, layout constraints, and state persistence.
 * @returns {UniqueComponent<Props>}
 */
export function createUniqueTransition(renderFn, props) {
  return createUnique(renderFn, addTransitionProps(props));
}

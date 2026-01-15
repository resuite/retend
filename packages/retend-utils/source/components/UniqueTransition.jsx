/** @import { JSX } from 'retend/jsx-runtime' */
/** @import { UniqueProps } from 'retend'; */
import { Cell, useObserver } from 'retend';
import { Unique } from 'retend';

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
 * @typedef {UniqueProps<CustomData> & TransitionProps} UniqueTransitionProps
 */

/**
 * Continuous Geometry Tracking
 *
 * Problem: The `onSave` callback may fire too late, after a parent style change
 * (e.g., `display: none`, visibility toggle, or DOM removal) has already hidden
 * the element. When this happens, `getBoundingClientRect()` returns a zero-sized
 * rect, breaking the FLIP animation.
 *
 * Solution: Continuously track the element's bounding rect while it's visible
 * using a ResizeObserver. This way, we always have the "last known good" geometry
 * to use in `onSave`, even if the element is no longer measurable at that moment.
 */

/** @type {WeakMap<Element, DOMRect>} */
const geometryCache = new WeakMap();

/** @type {WeakMap<Element, ResizeObserver>} */
const observerCache = new WeakMap();

/**
 * Starts tracking an element's geometry continuously.
 * @param {Element} element
 */
function startGeometryTracking(element) {
  if (observerCache.has(element)) return;

  const updateGeometry = () => {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      geometryCache.set(element, rect);
    }
  };

  updateGeometry();

  const resizeObserver = new ResizeObserver(updateGeometry);
  resizeObserver.observe(element);
  observerCache.set(element, resizeObserver);
}

/**
 * Stops tracking an element's geometry.
 * @param {Element} element
 */
function stopGeometryTracking(element) {
  const observer = observerCache.get(element);
  if (observer) {
    observer.disconnect();
    observerCache.delete(element);
  }
}

/**
 * Gets the last known good geometry for an element.
 * Falls back to getBoundingClientRect if no cached value exists.
 * @param {Element} element
 * @returns {DOMRect}
 */
function getTrackedGeometry(element) {
  return geometryCache.get(element) ?? element.getBoundingClientRect();
}

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
    maintainWidthDuringTransition,
    maintainHeightDuringTransition,
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
      const rect = getTrackedGeometry(element);
      // Stop tracking since content is moving away.
      stopGeometryTracking(element);
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
  const ref = props.ref ?? Cell.source(null);
  const observer = useObserver();

  observer.onConnected(ref, (element) => {
    startGeometryTracking(element);
    // Cleanup for cases where element disconnects without onSave
    // (e.g., parent component unmounts entirely).
    return () => stopGeometryTracking(element);
  });

  return <Unique {...addTransitionProps(props)} ref={ref} />;
}

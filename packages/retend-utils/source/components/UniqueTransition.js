/** @import { JSX } from 'retend/jsx-runtime' */
/** @import { DOMRenderer } from 'retend-web' */
import { getActiveRenderer, linkNodes, onMove } from 'retend';

/**
 * @typedef ElementUIState
 * @property {DOMRect[]} rects
 */

/**
 * @typedef TransitionProps
 * @property {string} [transitionDuration] How long the transition between states should take.
 * @property {string} [transitionTimingFunction] How the transition should be performed.
 * @property {boolean} [maintainWidthDuringTransition] If true, disables horizontal scaling during transitions.
 * @property {boolean} [maintainHeightDuringTransition] If true, disables vertical scaling during transitions.
 */

/**
 * @typedef {TransitionProps} UniqueTransitionOptions
 */

/**
 * @typedef {TransitionProps & { children: JSX.Children }} UniqueTransitionProps
 */

const TransitionAnimationSymbol = Symbol('UniqueTransitionAnimation');

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

  if (!transitionDuration) return { duration, easing };

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
 * @param {any} handle
 * @returns {Element[]}
 */
function getHandleElements(handle) {
  const start = handle[0];
  const end = handle[1];
  const elements = [];
  let node = start.nextSibling;
  while (node && node !== end) {
    if (node instanceof Element) elements.push(node);
    node = node.nextSibling;
  }
  return elements;
}

/**
 * @param {any} handle
 * @returns {ElementUIState | null}
 */
function saveState(handle) {
  const elements = getHandleElements(handle);
  if (!elements.length) return null;

  const rects = [];
  for (const element of elements) {
    rects.push(element.getBoundingClientRect());
    const transitionAnimation = Reflect.get(element, TransitionAnimationSymbol);
    if (transitionAnimation) {
      transitionAnimation.cancel();
      Reflect.deleteProperty(element, TransitionAnimationSymbol);
    }
    if (element instanceof HTMLElement) {
      element.style.removeProperty('transform');
    }
    element.removeAttribute('data-transitioning');
  }

  for (const element of elements) {
    const animations = element.getAnimations({ subtree: true });
    for (const animation of animations) animation.pause();
  }

  return { rects };
}

/**
 * @param {ElementUIState} elementState
 * @param {any} handle
 * @param {UniqueTransitionOptions} options
 */
function restoreTransition(elementState, handle, options) {
  const {
    transitionDuration,
    transitionTimingFunction,
    maintainWidthDuringTransition,
    maintainHeightDuringTransition,
  } = options;
  const elements = getHandleElements(handle);
  if (!elements.length) return;

  let anchor = null;
  for (const element of elements) {
    if (element instanceof HTMLElement) {
      anchor = element;
      break;
    }
  }
  if (!anchor) return;

  for (const element of elements) {
    for (const animation of element.getAnimations({ subtree: true })) {
      animation.play();
    }
  }
  const { rects } = elementState;

  const transition = parseTransitionOptions(
    transitionDuration,
    transitionTimingFunction,
    anchor
  );

  // Animations on ancestors of the target may modify the positioning
  // of the target element, making the bounding rect incorrect.
  // We need to recompute the new rect after all parent animations
  // have been scrubbed to the expected point on the document timeline.
  const parentAnimations = [
    ...new Set(elements.flatMap((element) => getAllParentAnimations(element))),
  ];
  for (const animation of parentAnimations) {
    const currentTime = Number(animation.currentTime);
    animation.currentTime = currentTime + transition.duration;
  }

  requestAnimationFrame(() => {
    const nextRects = [];
    for (const element of elements) {
      nextRects.push(element.getBoundingClientRect());
    }
    for (const anim of parentAnimations) {
      anim.currentTime = Number(anim.currentTime) - transition.duration;
    }
    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i];
      const oldRect = rects[i];
      if (!oldRect) continue;
      const newRect = nextRects[i];
      if (!newRect) continue;
      if (newRect.width === 0 && !maintainWidthDuringTransition) continue;
      if (newRect.height === 0 && !maintainHeightDuringTransition) continue;

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
      let initialTransform = displacement;
      if (isInvertible) {
        initialTransform = `${parentTransform.inverse().toString()} ${displacement}`;
      }

      if (element instanceof HTMLElement) {
        element.style.setProperty('transform', initialTransform);
      }
      element.setAttribute('data-transitioning', '');
      const animation = element.animate(
        { transform: [initialTransform, 'none'] },
        transition
      );
      Reflect.set(element, TransitionAnimationSymbol, animation);
      if (element instanceof HTMLElement) {
        element.style.removeProperty('transform');
      }
      animation.finished.finally(() => {
        if (Reflect.get(element, TransitionAnimationSymbol) !== animation) {
          return;
        }
        Reflect.deleteProperty(element, TransitionAnimationSymbol);
        element.removeAttribute('data-transitioning');
      });
    }
  });
}

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
 * Animates the children of a unique component as they move between locations
 * using a "First, Last, Invert, Play" (FLIP) strategy.
 *
 * This component must be rendered within a `createUnique(...)` component.
 *
 * ### Key Behaviors
 * - **Visual Continuity**: The children calculate their change in position
 * and scale (including parent transforms) and animates the difference.
 * - **Transition Styling**: The moved elements are marked with the
 * `data-transitioning` attribute while the animation is active.
 *
 * - The component must have an identifiable size (width/height > 0) in the
 * previous location for a transition to occur.
 *
 * @param {UniqueTransitionProps} props
 * @returns {JSX.Template}
 */
export function UniqueTransition(props) {
  const renderer = /** @type {DOMRenderer} */ (getActiveRenderer());
  const group = renderer.createGroup();
  linkNodes(group, props.children, renderer);
  const handle = renderer.createGroupHandle(group);

  onMove(() => {
    const state = saveState(handle);
    if (!state) return;
    return () => {
      restoreTransition(state, handle, props);
    };
  });

  return group;
}

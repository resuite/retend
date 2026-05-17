/** @import { JSX } from 'retend/jsx-runtime' */

import { getActiveRenderer, linkNodes, onMove } from 'retend';
import { DOMRenderer } from 'retend-web';

/**
 * @typedef ElementUIState
 * @property {Map<Element, DOMRect>} rects
 * @property {ElementAnimationState[]} animationState
 * @property {CSSTransition[]} transitions
 */

/**
 * @typedef ElementAnimationState
 * @property {Element} target
 * @property {string} animationName
 * @property {CSSNumberish | null} currentTime
 */

/**
 * @typedef TransitionProps
 * @property {string} [transitionDuration] How long the transition between states should take.
 * @property {string} [transitionTimingFunction] How the transition should be performed.
 * @property {string} [transformOrigin] The transform origin used during the transition.
 * @property {boolean} [maintainWidthDuringTransition] If true, disables horizontal scaling during transitions.
 * @property {boolean} [maintainHeightDuringTransition] If true, disables vertical scaling during transitions.
 * @property {boolean} [respectParentTransform] If false, ignores parent animations and transforms during transitions.
 * @property {boolean} [topLayer] If true, the children are placed in the top layer during transitions.
 * @property {() => void} [onStart] Called when the transition starts.
 * @property {() => void} [onEnd] Called when the transition ends.
 */

/**
 * @typedef {TransitionProps} UniqueTransitionOptions
 */

/**
 * @typedef {TransitionProps & { children: JSX.Children }} UniqueTransitionProps
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

/**
 *
 * @param {string | undefined} transitionDuration
 * @param {HTMLElement} element
 */
function parseTransitionDuration(transitionDuration, element) {
  let duration = 0;

  if (!transitionDuration) return duration;
  if (!transitionDuration.endsWith('s')) {
    const durationVar = '--unique-transition-duration';
    // Allows us to dynamically resolve the duration, so
    // calc() or css vars can be passed in.
    element.style.setProperty(durationVar, transitionDuration);
    const styles = getComputedStyle(element);
    const durationRaw = styles.getPropertyValue(durationVar);
    duration = durationRaw.endsWith('ms')
      ? Number(durationRaw.slice(0, -2))
      : Number(durationRaw.slice(0, -1)) * 1000;

    element.style.removeProperty(durationVar);
  } else {
    duration = transitionDuration.endsWith('ms')
      ? Number(transitionDuration.slice(0, -2))
      : Number(transitionDuration.slice(0, -1)) * 1000;
  }

  return duration;
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

  const rects = new Map();
  for (const element of elements) {
    rects.set(element, element.getBoundingClientRect());
  }

  /** @type {ElementAnimationState[]} */
  const animationState = [];
  const transitions = [];

  for (const element of elements) {
    const currentAnimations = element.getAnimations({ subtree: true });
    for (const a of currentAnimations) {
      if (!(a instanceof CSSAnimation)) {
        if (a instanceof CSSTransition) transitions.push(a);
        continue;
      }
      const { effect } = a;
      if (!(effect instanceof KeyframeEffect) || !effect.target) continue;

      animationState.push({
        target: effect.target,
        animationName: a.animationName,
        currentTime: a.currentTime,
      });
    }
  }

  return { rects, animationState, transitions };
}

/**
 * @param {ElementUIState} elementState
 * @param {any} handle
 * @param {UniqueTransitionOptions} options
 */
function restoreTransition(elementState, handle, options) {
  const {
    transitionDuration = '200ms',
    transitionTimingFunction = 'ease',
    transformOrigin: origin = 'top left',
    maintainWidthDuringTransition: maintainWidth,
    maintainHeightDuringTransition: maintainHeight,
    respectParentTransform = true,
    topLayer,
    onStart,
    onEnd,
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

  const { rects } = elementState;

  requestAnimationFrame(() => {
    restoreSubtreeAnimationsAndTransitions(elements, elementState);
  });

  const duration = parseTransitionDuration(transitionDuration, anchor);

  // Animations on ancestors of the target may modify the positioning
  // of the target element, making the bounding rect incorrect.
  // We need to recompute the new rect after all parent animations
  // have been scrubbed to the expected point on the document timeline.
  const parentAnimations = respectParentTransform
    ? [...new Set(elements.flatMap(getAllParentAnimations))]
    : [];
  for (const animation of parentAnimations) {
    const currentTime = Number(animation.currentTime);
    animation.currentTime = currentTime + duration;
  }

  requestAnimationFrame(async () => {
    const nextRects = new Map();
    for (const element of elements) {
      nextRects.set(element, element.getBoundingClientRect());
    }
    for (const anim of parentAnimations) {
      anim.currentTime = Number(anim.currentTime) - duration;
    }
    let cssText = '';
    /** @type {Promise<Animation>[]} */
    const finishedAnimations = [];
    /** @type {Map<Element, string>} */
    const transitionIds = new Map();
    const stylesheet = new CSSStyleSheet();

    for (const element of elements) {
      const oldRect = rects.get(element);
      if (!oldRect) continue;
      const newRect = nextRects.get(element);
      if (!newRect) continue;
      if (newRect.width === 0 && !maintainWidth) continue;
      if (newRect.height === 0 && !maintainHeight) continue;

      const parentTransform = respectParentTransform
        ? getParentTransformMatrix(element)
        : new DOMMatrix();
      const isInvertible =
        respectParentTransform &&
        Math.abs(
          parentTransform.a * parentTransform.d -
            parentTransform.b * parentTransform.c
        ) > 1e-10;
      const options = { maintainWidth, maintainHeight };
      const transform = getInitialRelativeTransform(oldRect, newRect, options);
      const initTransform = isInvertible
        ? `${parentTransform.inverse().toString()} ${transform}`
        : transform;
      const id = crypto.randomUUID();
      transitionIds.set(element, id);
      cssText += `
[data-transitioning="${id}"] {
  transform-origin:${origin};
  animation: animate-${id} ${transitionDuration} ${transitionTimingFunction} backwards !important;
}
[data-transitioning="${id}"][data-top-layer] {
  width:${newRect.width}px !important;
  height:${newRect.height}px !important;
  top:${newRect.top}px !important;
  left:${newRect.left}px !important;
}
:where([data-transitioning="${id}"]) {
  background-color:transparent;
  color:inherit;
  overflow:visible;
  margin:0;
  border:0;
  padding:0;
}
@keyframes animate-${id} {
  from { transform: ${initTransform}; }
  to { transform: none; }
}`;
    }

    if (transitionIds.size) {
      stylesheet.replaceSync(cssText);
      const stylesheets = [stylesheet, ...document.adoptedStyleSheets];
      document.adoptedStyleSheets = stylesheets;
    }

    for (const [element, id] of transitionIds) {
      element.setAttribute('data-transitioning', id);
      if (topLayer && element instanceof HTMLElement) {
        if (element.hasAttribute('popover')) elementCannotBePromoted();
        else {
          element.setAttribute('popover', 'manual');
          element.setAttribute('data-top-layer', 'true');
          element.showPopover();
        }
      }

      const [animation] = element.getAnimations(); // guaranteed to be the correct animation
      if (!animation) continue;
      const animationFinished = animation.finished.finally(() => {
        animation.cancel();
        element.removeAttribute('data-transitioning');
        if (topLayer && element.hasAttribute('data-top-layer')) {
          element.removeAttribute('data-top-layer');
          element.removeAttribute('popover');
        }
      });

      finishedAnimations.push(animationFinished);
    }

    onStart?.();
    await Promise.allSettled(finishedAnimations);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => {
      return s !== stylesheet;
    });
    onEnd?.();
  });
}

const elementCannotBePromoted = () => {
  console.error(
    '[UniqueTransition] Popover elements cannot be promoted during unique transitions.'
  );
};

/**
 * @param {Element[]} elements
 * @param {ElementUIState} elementState
 */
function restoreSubtreeAnimationsAndTransitions(elements, elementState) {
  const { animationState, transitions } = elementState;

  const newAnimations = elements.flatMap((element) => {
    return element.getAnimations({ subtree: true });
  });

  for (const newAnimation of newAnimations) {
    if (!(newAnimation instanceof CSSAnimation)) continue;

    const savedState = animationState.find((s) => {
      if (!(newAnimation.effect instanceof KeyframeEffect)) return false;
      return (
        s.animationName === newAnimation.animationName &&
        s.target === newAnimation.effect.target
      );
    });
    if (savedState) newAnimation.currentTime = savedState.currentTime;
  }

  for (const transition of transitions) {
    if (!(transition.effect instanceof KeyframeEffect)) continue;
    if (!transition.effect.target) continue;

    const target = transition.effect.target;
    target.animate(
      transition.effect.getKeyframes(),
      transition.effect.getTiming()
    );
  }
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
    if (!(renderer instanceof DOMRenderer)) return;
    const state = saveState(handle);
    if (!state) return;
    return () => {
      restoreTransition(state, handle, props);
    };
  });

  return group;
}

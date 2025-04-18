/// <reference types="vite/client" />
/** @import { SourceCell, ForOptions } from 'retend' */
/** @import { JSX } from 'retend/jsx-runtime' */

import { Cell, For, useObserver } from 'retend';
import { useDerivedValue } from '../hooks/use-derived-value.js';
import { getGlobalContext } from 'retend/context';

let stylesAdded = false;
const FLUID_LIST_STYLES = `
.retendFluidList {
  --factor: calc(100% + var(--gap));
  display: grid;
  max-width: 100%;
  max-height: 100%;
  padding: 0;
  margin: 0;
  transition-timing-function: var(--list-change-easing);
  transition-duration: var(--list-change-duration);
  transition-property: var(--list-transition-property);
  gap: var(--gap);

  &.block {
    grid-auto-flow: column;
  }

  .retendFluidListItem {
  width: var(--list-item-width);
  height: var(--list-item-height);
  list-style-type: none;

    .retendFluidList.from > & {
      grid-area: 1 / 1;
      translate: calc(var(--list-item-previous-col) * var(--factor))
        calc(var(--list-item-previous-row) * var(--factor));
    }

    .retendFluidList.to > & {
      transition-delay: calc(var(--curr) * var(--list-item-transition-delay));
      transition-timing-function: var(--list-change-easing);
      transition-duration: var(--list-change-duration);
      transition-property: var(--list-item-transition-property);

      grid-area: 1 / 1;
      translate: calc(var(--list-item-col) * var(--factor))
        calc(var(--list-item-row) * var(--factor));
    }
  }
}
`.trim();

/**
 * @typedef AnimatedListElementProps
 *
 * @property {string} [_lastTranslate]
 * @property {EffectTiming} [_lastTiming]
 * @property {Animation} [_restoredAnimation]
 * @property {Cell<number>} [_currentIndex]
 * @property {SourceCell<number>} [_previousIndex]
 */

/**
 * @typedef {HTMLElement & AnimatedListElementProps} AnimatedListElement
 */

/**
 *  Props passed to the `Template` component rendered for each item in the `FluidList`.
 *
 *  @template T
 *  @typedef {Object} ListTemplateProps
 *  @property {T} item - The data for the current item being rendered in the list.
 *  @property {Cell<number>} index - A `Cell` containing the current index of the item in the list.
 *  @property {Cell<number>} previousIndex - A `Cell` containing the old index of the item in the list, before it started animating.
 *  @property {Cell<T[]>} list - A `Cell` containing the entire array of items in the list.
 */

/**
 * @typedef {Omit<JSX.IntrinsicElements['ul'], 'ref' | 'style'>} UlListProps
 */

/**
 * @template U - The type of the data contained within each item in the list.
 * Configuration options for the `FluidList` component.
 *
 * @typedef FluidListAdditionalProps
 *
 * @property {SourceCell<HTMLUListElement | null>} [ref]
 * A `Cell` that will hold a reference to the `HTMLUListElement` representing the list, allowing direct manipulation of the list element via the DOM API.
 *
 * @property {JSX.StyleValue} [style]
 * CSS styles to be applied directly to the `<ul>` element.  Styles defined here override the default styles provided by the `FluidList` component.  Use this to customize the appearance of the list container.
 *
 * @property {JSX.ValueOrCell<'block' | 'inline'>} [direction]
 * The direction in which the list items are arranged.  Can be either `'block'` (horizontal) or `'inline'` (vertical).  This property influences the layout and sizing of the list items.
 *
 * @property {JSX.ValueOrCell<string>} [staggeredDelay]
 * A string representing the delay applied to the transition of each list item, creating a staggered animation effect.  The delay is applied sequentially to each item in the list.
 *
 * @property {Cell<U[]>} items
 * A `Cell` containing the array of data items to be rendered in the list. The `FluidList` component observes this `Cell` and automatically updates the list when the array changes.
 *
 * @property {JSX.ValueOrCell<string>} [itemHeight]
 * A string representing the fixed height of each list item. If not provided, the height will be determined by the content of the item.  This value should include a CSS unit (e.g., `'50px'`, `'2em'`, `'10vh'`).
 *
 * @property {JSX.ValueOrCell<string>} [itemWidth]
 * A string representing the fixed width of each list item. If not provided, the width will be determined by the content of the item.  This value should include a CSS unit (e.g., `'100px'`, `'5em'`, `'20vw'`).
 *
 * @property {JSX.ValueOrCell<string>} [speed]
 * A string representing the duration of the transition applied when the list items change size or position.  This value should include a CSS time unit (e.g., `'0.2s'`, `'500ms'`).
 *
 * @property {JSX.ValueOrCell<string>} [easing]
 * A string representing the easing function applied to the transition of list items.
 *
 * @property {JSX.ValueOrCell<string>} [gap]
 * A string representing the gap between list items.  This value should include a CSS unit (e.g., `'10px'`, `'0.5em'`, `'2vh'`).
 *
 * @property {U extends object ? keyof U : never} [itemKey]
 * The key of the `U` type to use as a marker for each rendered item.
 *
 * @property {JSX.ValueOrCell<boolean>} [animateSizing]
 * A boolean indicating whether the list items should animate their size (width and height) during transitions.  If `true`, the items will smoothly transition to their new size when the data changes.  If `false`, the size will change immediately.
 *
 * @property {(props: ListTemplateProps<U>) => JSX.Template} Template
 * A function that returns a JSX template to render for each item in the list. This function receives an object with the `item`, `index`, and `list` properties. Use this template to define the visual representation of each list item.
 *
 * @property {JSX.ValueOrCell<number>} [maxColumns]
 * The maximum number of horizontal columns the list can have before wrapping to the next row.
 * This is only taken into account when the `direction` is set to `'inline'`.
 *
 * @property {JSX.ValueOrCell<number>} [maxRows]
 * The maximum number of vertical rows the list can have before wrapping to the next column.
 * This is only taken into account when the `direction` is set to `'block'`.
 */

/**
 * @template Item
 * @typedef {UlListProps & FluidListAdditionalProps<Item>} FluidListProps
 */

/**
 * A list with support for dynamic sizing, staggered animations, and flexible layouts.
 *
 * @template Item - The type of the data contained within each item in the list.
 * @param {FluidListProps<Item>} props - The configuration options for the `FluidList` component. See {@link FluidListProps}.
 * @returns A JSX element representing the `FluidList` component.
 *
 * @example
 * ```tsx
 * import { Cell } from 'retend';
 * import { FluidList, type ListTemplateProps } from 'retend-utils/components';
 *
 * interface MyItem {
 *   id: number;
 *   name: string;
 * }
 *
 * const myItems = Cell.source<MyItem[]>([
 *   { id: 1, name: 'Item 1' },
 *   { id: 2, name: 'Item 2' },
 *   { id: 3, name: 'Item 3' },
 * ]);
 *
 * function MyItemTemplate({ item, index, list }: ListTemplateProps<MyItem>) {
 *   return (
 *     <div>
 *       <h2>{item.name}</h2>
 *       <p>Index: {index}</p>
 *     </div>
 *   );
 * }
 *
 * function MyComponent() {
 *   return (
 *     <FluidList
 *       items={myItems}
 *       itemKey="id"
 *       itemHeight="100px"
 *       gap="5px"
 *       direction="inline"
 *       Template={MyItemTemplate}
 *     />
 *   );
 * }
 * ```
 */
export function FluidList(props) {
  // The styles are generated in JS so that a separate CSS file (and thus a build step)
  // is not required. The styles are added in the render path of the component (as opposed
  // to in the onConnected callback of the observer) so that they can be inlined in the HTML
  // during SSR.
  if (!stylesAdded) {
    stylesAdded = true;
    const { window } = getGlobalContext();
    const document = window.document;
    /** @type {*} */
    const fluidStyles = document.createElement('style');
    fluidStyles.innerHTML = FLUID_LIST_STYLES;
    document.head.append(fluidStyles);
  }
  const {
    ref = Cell.source(null),
    items,
    itemKey,
    itemHeight: itemHeightProp,
    itemWidth: itemWidthProp,
    direction: directionProp = 'block',
    animateSizing: animateSizingProp,
    maxColumns: maxColumnsProp,
    maxRows: maxRowsProp,
    staggeredDelay = '0ms',
    speed = '0.2s',
    easing = 'ease',
    gap = '0px',
    Template,
    ...rest
  } = props;

  const manager = new AnimationSessionManager();
  const nextTranslate =
    'calc(var(--list-item-col) * var(--factor)) calc(var(--list-item-row) * var(--factor))';

  const observer = useObserver();
  const direction = useDerivedValue(directionProp);
  const itemWidth = useDerivedValue(itemWidthProp);
  const itemHeight = useDerivedValue(itemHeightProp);
  const animateSizing = useDerivedValue(animateSizingProp);
  const maxCols = useDerivedValue(maxColumnsProp);
  const maxRows = useDerivedValue(maxRowsProp);

  const directionClass = Cell.derived(() => direction.value);
  const len = Cell.derived(() => items.value.length);
  let previousLength = len.value;

  const rows = Cell.derived(() =>
    direction.value === 'inline'
      ? maxCols.value
        ? Math.max(Math.ceil(len.value / maxCols.value), 1)
        : 1
      : maxRows.value
      ? Math.min(maxRows.value, len.value)
      : Math.max(len.value, 1)
  );
  const previousRows = Cell.source(rows.value);

  const cols = Cell.derived(() =>
    direction.value === 'block'
      ? maxRows.value
        ? Math.max(Math.ceil(len.value / maxRows.value), 1)
        : 1
      : maxCols.value
      ? Math.min(maxCols.value, len.value)
      : Math.max(len.value, 1)
  );
  const previousCols = Cell.source(cols.value);

  const oldRows = Cell.derived(() => Math.max(rows.value, previousRows.value));
  const oldCols = Cell.derived(() => Math.max(cols.value, previousCols.value));

  const gridTemplateColumns = Cell.derived(
    () => `repeat(${cols.value}, ${itemWidth.value ?? 'min-content'})`
  );

  const gridTemplateRows = Cell.derived(
    () => `repeat(${rows.value}, ${itemHeight.value ?? 'min-content'})`
  );

  const height = Cell.derived(() => {
    if (!itemHeight.value) return '100%';
    const itemsTotalHeight = `(${rows.value} * ${itemHeight.value})`;
    const gaps = `(var(--gap) * ${rows.value - 1})`;
    return `calc(${itemsTotalHeight} + ${gaps})`;
  });

  const width = Cell.derived(() => {
    if (!itemWidth.value) return '100%';
    const itemsTotalWidth = `${cols.value} * ${itemWidth.value}`;
    const gaps = `(var(--gap) * ${cols.value - 1})`;
    return `calc(${itemsTotalWidth} + ${gaps})`;
  });

  const listTransitionProperty = Cell.derived(() =>
    animateSizing.value ? 'width, height' : 'none'
  );

  const itemTransitionProperty = Cell.derived(() =>
    animateSizing.value ? 'width, height, translate' : 'translate'
  );

  /** @type {JSX.StyleValue} */
  const style = {
    '--gap': gap,
    '--list-change-duration': speed,
    '--list-change-easing': easing,
    '--list-item-height': itemHeight,
    '--list-item-width': itemWidth,
    '--list-item-transition-property': itemTransitionProperty,
    '--list-item-transition-delay': staggeredDelay,
    '--list-transition-property': listTransitionProperty,
    '--rows': rows,
    '--prev-rows': previousRows,
    '--cols': cols,
    '--prev-cols': previousCols,
    '--old-rows': oldRows,
    '--old-cols': oldCols,

    height,
    width,
    gridTemplateRows,
    gridTemplateColumns,
  };

  /**
   *
   * @param {Item} item
   * @param {Cell<number>} idx
   */
  const ItemRenderer = (item, idx) => {
    const previousIdx = Cell.source(idx.value);
    const nodeRef = Cell.source(null);

    const listItemPreviousCol = Cell.derived(() =>
      direction.value === 'block'
        ? Math.trunc(previousIdx.value / oldRows.value)
        : previousIdx.value % oldCols.value
    );

    const listItemPreviousRow = Cell.derived(() =>
      direction.value === 'block'
        ? previousIdx.value % oldRows.value
        : Math.trunc(previousIdx.value / oldCols.value)
    );

    const listItemCol = Cell.derived(() =>
      direction.value === 'block'
        ? Math.trunc(idx.value / rows.value)
        : idx.value % cols.value
    );

    const listItemRow = Cell.derived(() =>
      direction.value === 'block'
        ? idx.value % rows.value
        : Math.trunc(idx.value / cols.value)
    );

    /** @type {JSX.StyleValue} */
    const styles = {
      '--prev': previousIdx,
      '--curr': idx,
      '--list-item-previous-col': listItemPreviousCol,
      '--list-item-previous-row': listItemPreviousRow,
      '--list-item-col': listItemCol,
      '--list-item-row': listItemRow,
    };

    observer.onConnected(nodeRef, (itemNode) => {
      const el = /** @type {AnimatedListElement} */ (itemNode);
      el._previousIndex = previousIdx;
      el._currentIndex = idx;
    });

    return (
      <li ref={nodeRef} class="retendFluidListItem" style={styles}>
        <Template
          item={item}
          index={idx}
          list={items}
          previousIndex={previousIdx}
        />
      </li>
    );
  };

  const completeAnimationSequence = async () => {
    if (!ref.value) return;
    const ul = ref.deproxy();
    const animations = ul.getAnimations();
    for (const child of ul.children) {
      animations.push(...child.getAnimations());
    }
    await Promise.allSettled(
      animations.map((animation) =>
        animation.finished.then(() => {
          if (!(animation.effect instanceof KeyframeEffect)) return;
          if (animation.effect.target === ul) return;

          const el = /** @type {AnimatedListElement} */ (
            animation.effect.target
          );
          el._lastTranslate = undefined;
          el._restoredAnimation = undefined;
          el._lastTiming = undefined;
          if (el._previousIndex && el._currentIndex) {
            el._previousIndex.value = el._currentIndex.value;
          }
        })
      )
    );
  };

  const beforeDomUpdates = () => manager.startNewSession();

  let animationIsAlreadyRunning = false;
  // Run only for interrupted animation sessions and moved nodes.
  /** @param {ChildNode[]} nodes */
  const onBeforeNodesMove = async (nodes) => {
    if (!animationIsAlreadyRunning) return;
    animationIsAlreadyRunning = true;
    for (const child of nodes) {
      if (!(child instanceof HTMLElement)) continue;
      const el = /** @type {AnimatedListElement} */ (child);
      if (el._restoredAnimation) el._restoredAnimation.commitStyles();
      el._lastTranslate = getComputedStyle(child).translate;
      el._lastTiming = el.getAnimations()[0]?.effect?.getComputedTiming();
      if (el._restoredAnimation) el.style.removeProperty('translate');
    }
  };

  /** @param {Item[]} newItems */
  const afterDomUpdates = async (newItems) => {
    if (previousLength === 0) {
      previousLength = newItems.length;
      return;
    }

    const sessionId = manager.activeSessionId;
    requestAnimationFrame(async () => {
      if (!ref.value) return;

      const list = ref.value;
      list.classList.add('from');

      /** @type {EffectTiming | undefined} */
      let fallbackTiming;
      for (const child of list.children) {
        if (!fallbackTiming) {
          const animations = child.getAnimations();
          fallbackTiming = animations[0]?.effect?.getComputedTiming();
        }
        const el = /** @type {AnimatedListElement} */ (child);
        if (!el._lastTranslate) continue;
        const timing = el._lastTiming ?? fallbackTiming;
        const keyframes = [
          { translate: el._lastTranslate },
          { translate: nextTranslate },
        ];

        el._restoredAnimation = el.animate(keyframes, timing);
      }

      requestAnimationFrame(async () => {
        if (!ref.value) return;

        list.classList.add('to');
        await completeAnimationSequence();
        if (sessionId !== manager.activeSessionId) return;

        ref.value.classList.remove('from', 'to');
        manager.endCurrentSession();
        animationIsAlreadyRunning = false;
      });
    });
  };

  rows.listen(async (colCount) => {
    if (await manager.currentSessionEnded) previousRows.value = colCount;
  });

  cols.listen(async (colCount) => {
    if (await manager.currentSessionEnded) previousCols.value = colCount;
  });

  if (rest.style) Object.assign(style, rest.style);

  observer.onConnected(ref, () => {
    items.listen(beforeDomUpdates, { priority: 1 });
    items.listen(afterDomUpdates, { priority: -1 });
    return () => {
      items.ignore(afterDomUpdates);
      items.ignore(beforeDomUpdates);
    };
  });

  return (
    <ul
      {...rest}
      ref={ref}
      class={['retendFluidList', directionClass, rest.class]}
      style={style}
    >
      {For(items, ItemRenderer, {
        key: itemKey,
        onBeforeNodesMove:
          /** @type {ForOptions<Item>['onBeforeNodesMove']} */ (
            onBeforeNodesMove
          ),
      })}
    </ul>
  );
}

class AnimationSessionManager {
  /** @type {string | null} */
  activeSessionId = null;
  currentSessionEnded = Promise.resolve(true);
  isActive = false;

  startNewSession() {
    if (this.isActive) this.abortCurrentSession();

    this.isActive = true;
    this.currentSessionEnded = new Promise((resolve) => {
      this.endCurrentSession = () => {
        this.isActive = false;
        this.activeSessionId = null;
        resolve(true);
      };
      this.abortCurrentSession = () => {
        this.isActive = false;
        resolve(false);
      };
    });

    this.activeSessionId = crypto.randomUUID();
    return this.activeSessionId;
  }

  abortCurrentSession() {}
  endCurrentSession() {}
}

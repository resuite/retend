import type { Cell } from 'retend';

import { If } from 'retend';

import { ChevronRightIcon } from '@/components/icons';
import classes from '@/styles/InspectorPanel.module.css';

interface RenderedByItemProps {
  item: {
    isLast: boolean;
    index: number;
    componentName: string;
  };
  totalParents: Cell<number>;
}

export function RenderedByItem(props: RenderedByItemProps) {
  const { item, totalParents } = props;
  const isFirstVisual = item.isLast;
  const opacity = `max(0.7, ${item.index + 1} / ${totalParents.get()})`;

  return (
    <div
      class={[
        classes.renderedByItem,
        {
          [classes.renderedByItemFirst]: isFirstVisual,
        },
      ]}
      style={{ opacity }}
    >
      {If(!isFirstVisual, () => (
        <span
          class={classes.renderedBySeparator}
          style={{ transform: 'rotate(180deg)' }}
        >
          <ChevronRightIcon />
        </span>
      ))}
      <span class={classes.renderedByName}>{item.componentName}</span>
    </div>
  );
}

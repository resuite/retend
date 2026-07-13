import { Cell, If } from 'retend';

import { ComponentTreeSearch } from '@/components/ComponentTreeSearch';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/ComponentTree.module.css';

export function ComponentTree() {
  const devRenderer = useDevToolsRenderer();
  const inspectorPanelIsOpen = Cell.derived(() => {
    return devRenderer.selectedNode.get() !== null;
  });
  const hasRoots = Cell.derived(() => devRenderer.rootNodes.get().length > 0);

  return (
    <div
      class={classes.tree}
      data-inspector-panel-open={inspectorPanelIsOpen}
      onPointerLeave={() => devRenderer.hoveredNode.set(null)}
    >
      {If(hasRoots, () => (
        <ComponentTreeSearch roots={devRenderer.rootNodes} />
      ))}
    </div>
  );
}

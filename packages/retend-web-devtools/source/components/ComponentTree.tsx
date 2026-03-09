import { Cell, If } from 'retend';

import { ComponentTreeSearch } from '@/components/ComponentTreeSearch';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/ComponentTree.module.css';

export function ComponentTree() {
  const devRenderer = useDevToolsRenderer();
  const inspectorPanelIsOpen = Cell.derived(() => {
    return devRenderer.selectedNode.get() !== null;
  });

  return (
    <div
      class={classes.tree}
      data-inspector-panel-open={inspectorPanelIsOpen}
      onPointerLeave={() => devRenderer.hoveredNode.set(null)}
    >
      {If(devRenderer.rootNode, (root) => (
        <ComponentTreeSearch root={root} />
      ))}
    </div>
  );
}

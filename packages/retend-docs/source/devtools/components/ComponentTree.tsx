import { If } from 'retend';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/ComponentTree.module.css';
import { ComponentTreeSearch } from './ComponentTreeSearch';

export function ComponentTree() {
  const devRenderer = useDevToolsRenderer();

  return (
    <div
      class={classes.tree}
      onPointerLeave={() => devRenderer.hoveredNode.set(null)}
    >
      {If(devRenderer.rootNode, (root) => (
        <ComponentTreeSearch root={root} />
      ))}
    </div>
  );
}

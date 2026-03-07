import { Cell, type __HMR_UpdatableFn } from 'retend';

import { ComponentTreeNode } from '@/core/devtools-renderer';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/ComponentTree.module.css';
import { resolveComponentName } from '@/utils/sourceMapUtils';

interface ComponentNameProps {
  node: ComponentTreeNode;
}

export function ComponentName(props: ComponentNameProps) {
  const { node } = props;
  const devRenderer = useDevToolsRenderer();

  const name = Cell.derivedAsync(() =>
    resolveComponentName(node, devRenderer.sourceCache, devRenderer.nameCache)
  );

  return (
    <>
      <span class={classes.angleBrackets}>&lt;</span>
      {name}
      <span class={classes.angleBrackets}> /&gt;</span>
    </>
  );
}

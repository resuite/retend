import { Cell, If } from 'retend';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

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

  const uniqueId = (() => {
    if (!Reflect.get(node.component, '__retendUnique')) return null;
    const p = node.props;
    if (!Array.isArray(p)) return null;
    const propsData = p[0];
    if (!propsData || typeof propsData !== 'object') return null;
    const id = Reflect.get(propsData, 'id');
    return typeof id === 'string' ? id : null;
  })();

  return (
    <>
      <span class={classes.angleBrackets}>&lt;</span>
      {name}
      {If(uniqueId, (id) => (
        <span class={classes.attributes}> id="{id}"</span>
      ))}
      <span class={classes.angleBrackets}> /&gt;</span>
      {If(uniqueId, () => (
        <span class={classes.tag}>unique</span>
      ))}
    </>
  );
}

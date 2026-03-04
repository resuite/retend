import { Cell, For, If, onConnected, onSetup } from 'retend';

import type {
  DevToolsDOMRenderer,
  ComponentTreeNode,
} from './devtools-renderer';

import classes from './ComponentTree.module.css';
import { getComponentName } from './devtools-renderer';

interface ComponentTreeProps {
  devRenderer: DevToolsDOMRenderer;
}

export function ComponentTree(props: ComponentTreeProps) {
  const { devRenderer } = props;

  return (
    <div
      class={classes.tree}
      onPointerLeave={() => devRenderer.hoveredNode.set(null)}
    >
      {If(devRenderer.rootNode, (root) => (
        <TreeNode node={root} devRenderer={devRenderer} depth={0} />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: ComponentTreeNode;
  devRenderer: DevToolsDOMRenderer;
  depth: number;
}

function TreeNode(props: TreeNodeProps) {
  const { node, devRenderer, depth } = props;
  const expanded = Cell.source(depth < 5);
  const rowRef = Cell.source<HTMLElement | null>(null);
  const name = getComponentName(node.component);
  const children = devRenderer.getChildren(node);
  const hasChildren = Cell.derived(() => children.get().length > 0);

  const toggleExpanded = () => {
    expanded.set(!expanded.get());
  };

  const isAnonymous = name === '[Anonymous]';
  const isInternalCore = [
    'outlet.content',
    'await.content',
    'await.fallback',
    'await.callback',
  ].includes(name.toLowerCase());

  const onPointerEnter = () => {
    devRenderer.hoveredNode.set(node);
  };
  const activeState = Cell.derived(() => {
    if (devRenderer.focusedNode.get() === node) {
      return 'true';
    }
    return undefined;
  });

  onSetup(() => {
    const expandForFocusedNode = () => {
      let current = devRenderer.focusedNode.get();
      while (current) {
        if (current === node) {
          if (!expanded.get()) {
            expanded.set(true);
          }
          return;
        }
        const parent = devRenderer.parentMap.get(current);
        if (!parent) {
          current = null;
        } else {
          current = parent;
        }
      }
    };

    expandForFocusedNode();
    devRenderer.focusedNode.listen(expandForFocusedNode, { weak: true });
  });

  onConnected(rowRef, (row) => {
    const scrollIfFocused = () => {
      if (devRenderer.focusedNode.get() !== node) {
        return;
      }
      requestAnimationFrame(() => {
        row.scrollIntoView({ block: 'nearest' });
      });
    };

    scrollIfFocused();
    devRenderer.focusedNode.listen(scrollIfFocused, { weak: true });
  });

  return (
    <div class={classes.node} style={{ '--depth': depth }}>
      <div
        class={classes.nodeHeader}
        ref={rowRef}
        onClick={toggleExpanded}
        onPointerEnter={onPointerEnter}
        data-active={activeState}
      >
        {If(hasChildren, {
          true: () => (
            <span class={classes.chevron}>
              {If(expanded, {
                true: () => <span>▼</span>,
                false: () => <span>▶</span>,
              })}
            </span>
          ),
          false: () => <span class={classes.leafDot}>•</span>,
        })}
        <span
          class={[
            classes.componentName,
            {
              [classes.anonymous]: isAnonymous,
              [classes.internalCore]: isInternalCore,
            },
          ]}
        >
          {name}
        </span>
      </div>
      {If(hasChildren, () =>
        If(expanded, () => (
          <div class={classes.children}>
            {For(children, (child) => (
              <TreeNode
                node={child}
                devRenderer={devRenderer}
                depth={depth + 1}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

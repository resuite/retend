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
  const expanded = Cell.source(depth < 6);
  const rowRef = Cell.source<HTMLElement | null>(null);
  const name = getComponentName(node.component);
  const children = devRenderer.getChildren(node);
  const hasChildren = Cell.derived(() => children.get().length > 0);

  const toggleExpanded = () => {
    expanded.set(!expanded.get());
  };

  const lowerName = name.toLowerCase();
  const isAnonymous = name === '[Anonymous]';
  let providerKey = '';
  let providerSuffix = '';
  const isScopeProvider = lowerName.endsWith('.provider');
  if (isScopeProvider) {
    providerKey = name.slice(0, name.length - 9);
    providerSuffix = name.slice(name.length - 9);
  }
  const isInternalCore = [
    'await',
    'outlet.content',
    'await.content',
    'await.fallback',
  ].includes(lowerName);
  const awaitPendingState = Cell.derived(() => {
    if (lowerName !== 'await.content') {
      if (lowerName !== 'awaits.contents') {
        return undefined;
      }
    }

    const parent = devRenderer.parentMap.get(node);
    if (!parent) {
      return undefined;
    }

    const parentName = getComponentName(parent.component).toLowerCase();
    if (parentName !== 'await') {
      if (parentName !== 'awaits') {
        return undefined;
      }
    }

    const siblings = devRenderer.getChildren(parent).get();
    for (let i = 0; i < siblings.length; i += 1) {
      const siblingName = getComponentName(siblings[i].component).toLowerCase();
      if (siblingName === 'await.fallback') {
        return 'true';
      }
      if (siblingName === 'awaits.fallback') {
        return 'true';
      }
    }

    return undefined;
  });

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
    <div
      class={classes.node}
      style={{ '--depth': depth }}
      data-await-pending={awaitPendingState}
    >
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
        {If(isScopeProvider, {
          true: () => (
            <span
              class={[
                classes.componentName,
                classes.scopeProvider,
                {
                  [classes.anonymous]: isAnonymous,
                  [classes.internalCore]: isInternalCore,
                },
              ]}
            >
              <span class={classes.scopeKey}>{providerKey}</span>
              <span class={classes.scopeSuffix}>{providerSuffix}</span>
            </span>
          ),
          false: () => (
            <span
              class={[
                classes.componentName,
                {
                  [classes.anonymous]: isAnonymous,
                  [classes.internalCore]: isInternalCore,
                },
              ]}
            >
              <span class={classes.angleBrackets}>&lt;</span>
              {name}
              <span class={classes.angleBrackets}> /&gt;</span>
              {If(awaitPendingState, () => (
                <span class={classes.awaitPendingSpinner} />
              ))}
            </span>
          ),
        })}
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

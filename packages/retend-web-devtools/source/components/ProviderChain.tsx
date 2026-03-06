import { Cell, For, If } from 'retend';

import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/ComponentTree.module.css';
import { ComponentName } from './ComponentName';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { TreeNode, type TreeNodeProps } from './TreeNode';

export function isProviderNode(node: ComponentTreeNode): boolean {
  return node.component.name.includes('Provider');
}

function collectProviderChain(
  startNode: ComponentTreeNode,
  getChildren: (node: ComponentTreeNode) => Cell<Array<ComponentTreeNode>>
): Array<ComponentTreeNode> {
  const chain: Array<ComponentTreeNode> = [];
  let current = startNode;

  while (true) {
    chain.push(current);
    const children = getChildren(current).get();
    if (children.length !== 1) break;
    const onlyChild = children[0];
    if (!isProviderNode(onlyChild)) break;
    current = onlyChild;
  }

  return chain;
}

export function ProviderChain(props: TreeNodeProps) {
  const { node, depth, forceExpanded, visibleNodes } = props;
  const devRenderer = useDevToolsRenderer();
  const getChildren = devRenderer.getNodeChildren.bind(devRenderer);

  const chain = Cell.derived(() => collectProviderChain(node, getChildren));
  const chainLength = Cell.derived(() => chain.get().length);
  const isCollapsible = Cell.derived(() => chainLength.get() >= 2);

  const chainExpanded = Cell.source(false);
  const isChainExpanded = Cell.derived(() => {
    if (forceExpanded.get()) return true;
    return chainExpanded.get();
  });

  const lastInChain = Cell.derived(() => {
    const c = chain.get();
    return c[c.length - 1];
  });
  const continuationChildren = Cell.derived(() => {
    return getChildren(lastInChain.get()).get();
  });

  const onBadgeClick = (event: MouseEvent) => {
    event.stopPropagation();
    chainExpanded.set(!chainExpanded.get());
  };

  const onProviderClick = (providerNode: ComponentTreeNode) => {
    devRenderer.selectedNode.set(providerNode);
  };

  const onProviderPointerEnter = (providerNode: ComponentTreeNode) => {
    devRenderer.hoveredNode.set(providerNode);
  };

  return If(isCollapsible, {
    true: () => {
      const selectedState = Cell.derived(() => {
        const selected = devRenderer.selectedNode.get();
        for (const provider of chain.get()) {
          if (selected === provider) return 'true';
        }
        return undefined;
      });

      return (
        <div class={classes.node} style={{ '--depth': depth }}>
          <div
            class={[classes.nodeHeader, classes.providerChainHeader]}
            onClick={onBadgeClick}
            data-selected={selectedState}
          >
            <span class={classes.chevron}>
              {If(isChainExpanded, {
                true: () => <ChevronDownIcon />,
                false: () => <ChevronRightIcon />,
              })}
            </span>
            <span class={classes.providerBadge}>{chainLength} providers</span>
          </div>

          {If(isChainExpanded, () => (
            <div class={classes.providerChainList}>
              {For(chain, (provider) => (
                <div
                  class={classes.providerChainItem}
                  onClick={() => onProviderClick(provider)}
                  onPointerEnter={() => onProviderPointerEnter(provider)}
                >
                  <span class={classes.componentName}>
                    <ComponentName component={provider.component} />
                  </span>
                </div>
              ))}
            </div>
          ))}

          <div class={classes.providerContinuation}>
            {For(continuationChildren, (child) => (
              <TreeNode
                node={child}
                depth={depth + 1}
                forceExpanded={forceExpanded}
                visibleNodes={visibleNodes}
              />
            ))}
          </div>
        </div>
      );
    },
    false: () => (
      <TreeNode
        node={node}
        depth={depth}
        forceExpanded={forceExpanded}
        visibleNodes={visibleNodes}
        bypassProviderCollapse
      />
    ),
  });
}

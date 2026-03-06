import {
  __HMR_UpdatableFn,
  Await,
  Cell,
  For,
  If,
  createNodesFromTemplate,
} from 'retend';
import { ShadowRoot, Teleport } from 'retend-web';
import { Link, Outlet } from 'retend/router';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

import { ComponentName } from '@/components/ComponentName';
import { ChevronDownIcon, ChevronRightIcon, DotIcon } from '@/components/icons';
import { isProviderNode, ProviderChain } from '@/components/ProviderChain';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/ComponentTree.module.css';

const specialComponents = new Set<__HMR_UpdatableFn>([Await, Link, Outlet]);
const webSpecialComponents = new Set<__HMR_UpdatableFn>([Teleport, ShadowRoot]);

export interface TreeNodeProps {
  node: ComponentTreeNode;
  depth: number;
  forceExpanded: Cell<boolean>;
  visibleNodes: Cell<Set<ComponentTreeNode>>;
  bypassProviderCollapse?: boolean;
}

export function TreeNode(props: TreeNodeProps) {
  const { node, depth, forceExpanded, visibleNodes, bypassProviderCollapse } =
    props;
  const devRenderer = useDevToolsRenderer();
  const expanded = Cell.source(depth < 6);
  const name = node.component.name;

  const children = devRenderer.getNodeChildren(node);
  const hasChildren = Cell.derived(() => children.get().length > 0);
  const isVisible = Cell.derived(() => visibleNodes.get().has(node));
  const isExpanded = Cell.derived(() => {
    if (forceExpanded.get()) {
      return true;
    }
    return expanded.get();
  });

  const shouldCollapseAsProvider = Cell.derived(() => {
    if (bypassProviderCollapse) return false;
    if (!isProviderNode(node)) return false;
    const nodeChildren = children.get();
    if (nodeChildren.length !== 1) return false;
    return isProviderNode(nodeChildren[0]);
  });

  const isAnonymous = name === '[Anonymous]';
  const isSpecial = specialComponents.has(node.component);
  const isWebSpecial = webSpecialComponents.has(node.component);
  const isScopeProvider = Reflect.has(node.component, '__isScopeProviderOf');

  const onNodeClick = (event: MouseEvent) => {
    devRenderer.selectedNode.set(node);
    const currentTarget = event.currentTarget;
    if (currentTarget instanceof HTMLElement) {
      currentTarget.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
    if (node.output) {
      const renderedNodes = createNodesFromTemplate(node.output, devRenderer);
      let firstNode = renderedNodes[0];
      if (renderedNodes.length === 1) {
        const anchorNode = renderedNodes[0];
        if (anchorNode instanceof Comment) {
          const teleportedContainer = Reflect.get(
            anchorNode,
            '__retendTeleportedContainer'
          );
          if (teleportedContainer instanceof Element) {
            const teleportedFirstNode = teleportedContainer.firstChild;
            if (teleportedFirstNode) {
              firstNode = teleportedFirstNode;
            } else {
              firstNode = teleportedContainer;
            }
          }
        }
      }
      const options: ScrollIntoViewOptions = {
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      };
      if (firstNode instanceof Element) {
        firstNode.scrollIntoView(options);
      } else if (firstNode && firstNode.parentElement) {
        firstNode.parentElement?.scrollIntoView(options);
      }
    }
  };

  const onChevronClick = (event: MouseEvent) => {
    event.stopPropagation();
    expanded.set(!expanded.get());
  };

  const onPointerEnter = () => {
    devRenderer.hoveredNode.set(node);
  };

  const selectedState = Cell.derived(() => {
    if (devRenderer.selectedNode.get() === node) {
      return 'true';
    }
    return undefined;
  });

  return If(isVisible, () =>
    If(shouldCollapseAsProvider, {
      true: () => (
        <ProviderChain
          node={node}
          depth={depth}
          forceExpanded={forceExpanded}
          visibleNodes={visibleNodes}
        />
      ),
      false: () => (
        <div class={classes.node}>
          <div
            class={classes.nodeHeader}
            onClick={onNodeClick}
            onPointerEnter={onPointerEnter}
            data-selected={selectedState}
          >
            {If(hasChildren, {
              true: () => (
                <span class={classes.chevron} onClick={onChevronClick}>
                  {If(isExpanded, {
                    true: () => <ChevronDownIcon />,
                    false: () => <ChevronRightIcon />,
                  })}
                </span>
              ),
              false: () => (
                <span class={classes.leafDot}>
                  <DotIcon />
                </span>
              ),
            })}
            <span
              class={[
                classes.componentName,
                {
                  [classes.anonymous]: isAnonymous,
                  [classes.internalCore]: isSpecial,
                  [classes.webCore]: isWebSpecial,
                  [classes.scopeProvider]: isScopeProvider,
                },
              ]}
            >
              <ComponentName component={node.component} />
            </span>
          </div>
          {If(hasChildren, () => (
            <div class={classes.children}>
              {If(isExpanded, () =>
                For(children, (child) => (
                  <TreeNode
                    node={child}
                    depth={depth + 1}
                    forceExpanded={forceExpanded}
                    visibleNodes={visibleNodes}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      ),
    })
  );
}

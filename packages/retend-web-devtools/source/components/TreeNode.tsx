import {
  __HMR_UpdatableFn,
  Await,
  Cell,
  For,
  If,
  createNodesFromTemplate,
} from 'retend';
import { Link, Outlet } from 'retend/router';
import { ShadowRoot, Teleport } from 'retend-web';

import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/ComponentTree.module.css';
import { ComponentName } from './ComponentName';
import { ChevronDownIcon, ChevronRightIcon, DotIcon } from './icons';

const specialComponents = new Set<__HMR_UpdatableFn>([Await, Link, Outlet]);
const webSpecialComponents = new Set<__HMR_UpdatableFn>([Teleport, ShadowRoot]);

export interface TreeNodeProps {
  node: ComponentTreeNode;
  depth: number;
  forceExpanded: Cell<boolean>;
  visibleNodes: Cell<Set<ComponentTreeNode>>;
}

export function TreeNode(props: TreeNodeProps) {
  const { node, depth, forceExpanded, visibleNodes } = props;
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

  const isAnonymous = name === '[Anonymous]';
  const isSpecial = specialComponents.has(node.component);
  const isWebSpecial = webSpecialComponents.has(node.component);

  const onNodeClick = () => {
    devRenderer.selectedNode.set(node);
    if (node.output) {
      const renderedNodes = createNodesFromTemplate(node.output, devRenderer);
      const firstNode = renderedNodes[0];
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

  return If(isVisible, () => (
    <div class={classes.node} style={{ '--depth': depth }}>
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
  ));
}

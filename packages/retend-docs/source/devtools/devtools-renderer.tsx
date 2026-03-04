import {
  __HMR_UpdatableFn,
  Cell,
  createScope,
  onSetup,
  SourceCell,
  StateSnapshot,
  useScopeContext,
} from 'retend';
import { DOMRenderer } from 'retend-web';
import { JSX } from 'retend/jsx-runtime';

export interface ComponentTreeNode {
  component: __HMR_UpdatableFn;
  props?: Record<string, unknown>;
  fileData?: JSX.JSXDevFileData;
  output?: JSX.Template;
}

// using this instead of useComponentAncestry so we can
// track multiple chains of the same function.
const ParentNodeScope = createScope<ComponentTreeNode>();

function useParentTreeNode() {
  try {
    return useScopeContext(ParentNodeScope);
  } catch {
    return undefined;
  }
}

export class DevToolsDOMRenderer extends DOMRenderer {
  rootNode: SourceCell<ComponentTreeNode | null> = Cell.source(null);
  hoveredNode: SourceCell<ComponentTreeNode | null> = Cell.source(null);
  focusedNode: SourceCell<ComponentTreeNode | null> = Cell.source(null);
  disableHighlightTransition: SourceCell<boolean> = Cell.source(false);
  parentMap: Map<ComponentTreeNode, ComponentTreeNode> = new Map();
  childrenMap: Map<ComponentTreeNode, SourceCell<Array<ComponentTreeNode>>> =
    new Map();

  getChildren(node: ComponentTreeNode) {
    let cell = this.childrenMap.get(node);
    if (!cell) {
      cell = Cell.source<Array<ComponentTreeNode>>([]);
      this.childrenMap.set(node, cell);
    }
    return cell;
  }

  attachTreeNode(
    treeNode: ComponentTreeNode,
    parentInTree: ComponentTreeNode | undefined
  ) {
    if (parentInTree) {
      this.parentMap.set(treeNode, parentInTree);
      const siblingsCell = this.getChildren(parentInTree);
      siblingsCell.set([...siblingsCell.get(), treeNode]);
      return;
    }
    this.rootNode.set(treeNode);
  }

  detachTreeNode(treeNode: ComponentTreeNode) {
    const currentParent = this.parentMap.get(treeNode);
    this.parentMap.delete(treeNode);
    this.childrenMap.delete(treeNode);
    if (currentParent) {
      const siblingsCell = this.childrenMap.get(currentParent);
      if (siblingsCell) {
        const siblings = siblingsCell.get();
        siblingsCell.set(siblings.filter((child) => child !== treeNode));
      }
    }
    if (treeNode === this.rootNode.get()) this.rootNode.set(null);
    if (treeNode === this.focusedNode.get()) this.focusedNode.set(null);
  }

  override handleComponent(
    tagname: __HMR_UpdatableFn,
    props: any,
    _?: StateSnapshot,
    fileData?: JSX.JSXDevFileData
  ): Node | Node[] {
    const componentName = getComponentName(tagname);
    if (componentName === 'true' || componentName === 'false') {
      // skip If() branches.
      return super.handleComponent(tagname, props, _, fileData);
    }

    const treeNode: ComponentTreeNode = { component: tagname, props, fileData };
    const parent = useParentTreeNode();
    const parentInTree = parent;

    onSetup(() => {
      this.attachTreeNode(treeNode, parentInTree);
      return () => {
        this.detachTreeNode(treeNode);
      };
    });

    return ParentNodeScope.Provider({
      h: false,
      value: treeNode,
      children: () => {
        const output = super.handleComponent(tagname, props, _, fileData);
        treeNode.output = output;
        return output;
      },
    }) as Node | Node[];
  }
}

export function getComponentName(fn: __HMR_UpdatableFn) {
  return Reflect.get(fn, 'displayName') || fn.name || '[Anonymous]';
}

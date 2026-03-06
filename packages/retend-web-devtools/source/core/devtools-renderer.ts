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
  output?: Node | Node[];
}

export type HighlightColor = 'blue' | 'pink' | 'green' | 'red' | 'amber';

export interface CursorPosition {
  x: number;
  y: number;
}

const controlFlowNames = new Set([
  'true',
  'false',
  'For.Item',
  'If.True',
  'If.False',
  'Switch.Case',
  'Outlet.Content',
  'Await.Content',
]);

export class DevToolsDOMRenderer extends DOMRenderer {
  rootNode = Cell.source<ComponentTreeNode | null>(null);
  hoveredNode = Cell.source<ComponentTreeNode | null>(null);
  selectedNode = Cell.source<ComponentTreeNode | null>(null);
  highlightColor = Cell.source<HighlightColor>('blue');
  pickerCursorPosition = Cell.source<CursorPosition | null>(null);
  pickerHoveredElement = Cell.source<Element | null>(null);
  isPickerActive = Cell.source<boolean>(false);
  parentMap = new Map<ComponentTreeNode, ComponentTreeNode>();
  childrenMap = new Map<
    ComponentTreeNode,
    SourceCell<Array<ComponentTreeNode>>
  >();
  parentNodeScope = createScope<ComponentTreeNode>();

  outputs = new WeakMap<Node, ComponentTreeNode>();

  useParentNode() {
    try {
      return useScopeContext(this.parentNodeScope);
    } catch {
      return undefined;
    }
  }

  getNodeChildren(node: ComponentTreeNode) {
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
      const siblingsCell = this.getNodeChildren(parentInTree);
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
    if (treeNode === this.selectedNode.get()) this.selectedNode.set(null);
  }

  override handleComponent(
    tagname: __HMR_UpdatableFn,
    props: any,
    _?: StateSnapshot,
    fileData?: JSX.JSXDevFileData
  ): Node | Node[] {
    const componentName = tagname.name;
    if (controlFlowNames.has(componentName)) {
      return super.handleComponent(tagname, props, _, fileData);
    }

    const treeNode: ComponentTreeNode = {
      component: tagname,
      props,
    };
    const parentInTree = this.useParentNode();

    onSetup(() => {
      this.attachTreeNode(treeNode, parentInTree);
      return () => this.detachTreeNode(treeNode);
    });

    return this.parentNodeScope.Provider({
      h: false,
      value: treeNode,
      children: () => {
        const output = super.handleComponent(tagname, props, _, fileData);
        treeNode.output = output;
        if (Array.isArray(output)) {
          for (const node of output) {
            if (!this.outputs.has(node)) {
              this.outputs.set(node, treeNode);
            }
          }
        } else if (!this.outputs.has(output)) {
          this.outputs.set(output, treeNode);
        }
        return output;
      },
    }) as Node | Node[];
  }
}

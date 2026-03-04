import {
  __HMR_UpdatableFn,
  createScope,
  onSetup,
  StateSnapshot,
  useScopeContext,
} from 'retend';
import { DOMRenderer } from 'retend-web';
import { JSX } from 'retend/jsx-runtime';

interface ComponentTreeNode {
  component: __HMR_UpdatableFn;
  props?: Record<string, unknown>;
  fileData?: JSX.JSXDevFileData;
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
  rootComponentNode?: ComponentTreeNode;
  childrenMap: Map<ComponentTreeNode, Array<ComponentTreeNode>> = new Map();

  override handleComponent(
    tagname: __HMR_UpdatableFn,
    props: any,
    _?: StateSnapshot,
    fileData?: JSX.JSXDevFileData
  ): Node | Node[] {
    const treeNode = { component: tagname, props, fileData };

    const parent = useParentTreeNode();
    if (parent) {
      const siblings = this.childrenMap.get(parent) || [];
      siblings.push(treeNode);
      this.childrenMap.set(parent, siblings);
    } else {
      this.rootComponentNode = treeNode;
    }

    onSetup(() => {
      return () => {
        this.childrenMap.delete(treeNode);
        if (parent) {
          const children = this.childrenMap.get(parent);
          if (children) children.splice(children.indexOf(treeNode), 1);
        }
      };
    });

    return ParentNodeScope.Provider({
      h: false,
      value: treeNode,
      children: () => super.handleComponent(tagname, props, _, fileData),
    }) as Node | Node[];
  }
}

function _getComponentName(fn: __HMR_UpdatableFn) {
  return Reflect.get(fn, 'displayName') || fn.name || '[Anonymous]';
}

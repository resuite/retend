import type { JSX } from 'retend/jsx-runtime';

import {
  ASCIIFontRenderable,
  BoxRenderable,
  type CliRenderer,
  CodeRenderable,
  InputRenderable,
  MarkdownRenderable,
  Renderable,
  ScrollBoxRenderable,
  SelectRenderable,
  TabSelectRenderable,
  TextareaRenderable,
  TextAttributes,
  TextRenderable,
} from '@opentui/core';
import {
  type __HMR_UpdatableFn,
  type Capabilities,
  normalizeJsxChild,
  type ReconcilerOptions,
  type Observer,
  type Renderer,
  type RendererTypes,
  createNodesFromTemplate,
  branchState,
  withState,
  type StateSnapshot,
} from 'retend';

import type { RenderableRange } from './extensions';

import { _FragmentRenderable, _AnchorRenderable } from './extensions';
import * as nodeOps from './node-ops';

interface OpenTuiRendererOptions extends RendererTypes {
  Node: Renderable;
  Handle: RenderableRange;
  Group: _FragmentRenderable;
  Text: TextRenderable;
  Container: Renderable;
  Host: EventTarget;
  SavedNodeState: never;
}

export class OpenTuiRenderer implements Renderer<OpenTuiRendererOptions> {
  host: EventTarget;
  observer: Observer | null;
  #state?: StateSnapshot;

  capabilities: Capabilities = {
    supportsObserverConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  constructor(public cliRenderer: CliRenderer) {
    this.host = new EventTarget();
    this.observer = null;
  }

  render(app: JSX.Template): Renderable | Renderable[] {
    // Trying to render in the global state can lead to memory leaks
    // or vanishing derived cells.
    this.#state = branchState();

    return withState(this.#state, () => {
      const result = normalizeJsxChild(app, this);
      if (Array.isArray(result)) {
        for (const child of result) this.cliRenderer.root.add(child);
      } else this.cliRenderer.root.add(result);

      return result;
    });
  }

  createGroup(): _FragmentRenderable {
    return new _FragmentRenderable(this.cliRenderer.root.ctx, {});
  }

  createContainer(tagname: keyof JSX.IntrinsicElements): Renderable {
    switch (tagname) {
      case 'box':
        return new BoxRenderable(this.cliRenderer.root.ctx, {});
      case 'text':
        return new TextRenderable(this.cliRenderer.root.ctx, {});
      case 'b':
        return new TextRenderable(this.cliRenderer.root.ctx, {
          attributes: TextAttributes.BOLD,
        });
      case 'i':
        return new TextRenderable(this.cliRenderer.root.ctx, {
          attributes: TextAttributes.ITALIC,
        });
      case 'br':
        return new TextRenderable(this.cliRenderer.root.ctx, {
          content: '',
        });
      case 'input':
        return new InputRenderable(this.cliRenderer.root.ctx, {});
      case 'select':
        return new SelectRenderable(this.cliRenderer.root.ctx, {});
      case 'ascii_font':
        return new ASCIIFontRenderable(this.cliRenderer.root.ctx, {});
      case 'tab_select':
        return new TabSelectRenderable(this.cliRenderer.root.ctx, {});
      case 'scrollbox':
        return new ScrollBoxRenderable(this.cliRenderer.root.ctx, {});
      case 'code':
        return new CodeRenderable(this.cliRenderer.root.ctx, {});
      case 'textarea':
        return new TextareaRenderable(this.cliRenderer.root.ctx, {});
      case 'markdown':
        return new MarkdownRenderable(this.cliRenderer.root.ctx, {});
      default:
        return new BoxRenderable(this.cliRenderer.root.ctx, {});
    }
  }

  createText(text: string): TextRenderable {
    return new TextRenderable(this.cliRenderer.root.ctx, { content: text });
  }

  isNode(child: any): child is Renderable {
    return child instanceof Renderable;
  }

  isGroup(child: any): child is _FragmentRenderable {
    return child instanceof _FragmentRenderable;
  }

  updateText(text: string, node: TextRenderable): TextRenderable {
    node.content = text;
    return node;
  }

  setProperty<N extends Renderable>(node: N, key: string, value: any): N {
    nodeOps.setProperty(node, key, value);
    return node;
  }

  unwrapGroup(node: _FragmentRenderable): Renderable[] {
    return node.getChildren();
  }

  append(parent: Renderable, child: Renderable | Renderable[]): Renderable {
    if (Array.isArray(child)) {
      const children = child.filter(Boolean);
      for (const child of children) nodeOps.append(parent, child);
    } else if (child instanceof _FragmentRenderable) {
      for (const subchild of child.getChildren()) {
        nodeOps.append(parent, subchild);
      }
    } else nodeOps.append(parent, child);
    return parent;
  }

  createGroupHandle(group: BoxRenderable): RenderableRange {
    const handleStart = new _AnchorRenderable(group.ctx, {});
    const handleEnd = new _AnchorRenderable(group.ctx, {});
    group.add(handleStart, 0);
    group.add(handleEnd, group.getChildrenCount() + 1);
    return [handleStart, handleEnd];
  }

  write(handle: RenderableRange, newContent: Renderable[]) {
    nodeOps.writeToRange(handle, newContent);
  }

  reconcile(handle: RenderableRange, options: ReconcilerOptions<Renderable>) {
    nodeOps.writeToRange(handle, nodeOps.collectReconciledNodes(options));
  }

  handleComponent(tagname: __HMR_UpdatableFn, props: any[]) {
    const template = tagname(...props);
    const nodes = createNodesFromTemplate(template, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  // Stubs.
  isActive(node: Renderable) {
    return nodeOps.isConnected(this.cliRenderer.root, node);
  }

  saveContainerState(): never {
    throw new Error('Not implemented');
  }

  restoreContainerState(): void {
    throw new Error('Not implemented');
  }
}

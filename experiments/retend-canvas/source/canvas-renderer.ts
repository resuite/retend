import type { JSX } from 'retend/jsx-runtime';

import {
  getState,
  normalizeJsxChild,
  type Observer,
  withState,
  type Renderer,
  type ReconcilerOptions,
  type __HMR_UpdatableFn,
  type StateSnapshot,
  type Capabilities,
  setActiveRenderer,
  runPendingSetupEffects,
  createNodesFromTemplate,
  Cell,
  AsyncCell,
  useAwait,
} from 'retend';

import {
  append,
  CanvasAnchor,
  CanvasContainer,
  CanvasFragment,
  CanvasHost,
  CanvasNode,
  type CanvasRange,
  CanvasRect,
  type CanvasTag,
  CanvasText,
  collectReconciledNodes,
  write,
} from './tree';

interface CanvasRenderingTypes {
  Node: CanvasNode;
  Handle: CanvasRange;
  Text: CanvasText;
  Container: CanvasContainer;
  Group: CanvasFragment;
  Host: CanvasHost;
}

type CanvasRendererInterface = Renderer<CanvasRenderingTypes>;

export class CanvasRenderer implements CanvasRendererInterface {
  host: CanvasHost;
  observer: Observer | null;
  #state?: StateSnapshot;
  #root: CanvasContainer;

  capabilities: Capabilities = {
    supportsObserverConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  #requestRender() {}

  constructor(host: CanvasHost) {
    this.host = host;
    this.observer = null;
    this.#root = new CanvasContainer('root');
  }

  render(app: JSX.Template): CanvasNode | CanvasNode[] {
    this.#state = getState();

    return withState(this.#state, () => {
      const result = normalizeJsxChild(app, this);
      if (Array.isArray(result)) {
        for (const child of result) this.#root.append(child);
      } else this.#root.append(result);
      this.#requestRender();
      return result;
    });
  }

  createGroup(): CanvasFragment {
    return new CanvasFragment();
  }

  createContainer(tagname: CanvasTag): CanvasContainer {
    switch (tagname) {
      case 'rect':
        return new CanvasRect();
      default:
        return new CanvasContainer(tagname);
    }
  }

  createText(text: string): CanvasNode {
    return new CanvasText(text);
  }

  isNode(child: any): child is CanvasNode {
    return child instanceof CanvasNode;
  }

  isGroup(child: any): child is CanvasFragment {
    return child instanceof CanvasFragment;
  }

  updateText(text: string, node: CanvasText): CanvasNode {
    node.content = text;
    this.#requestRender();
    return node;
  }

  setProperty<N extends CanvasNode>(node: N, key: string, value: unknown): N {
    if (!(node instanceof CanvasContainer)) return node;

    if (!Cell.isCell(value)) {
      node.attributes[key] = value;
      if (node.isConnectedTo(this.#root)) this.#requestRender();
      return node;
    }

    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
    const updateProperty = (nextValue: any) => {
      if (nextValue instanceof Promise) nextValue.then(updateProperty);
      else {
        node.attributes[key] = nextValue;
        if (node.isConnectedTo(this.#root)) this.#requestRender();
      }
    };

    const rawVal = value.get();
    updateProperty(rawVal);
    value.listen(updateProperty);
    return node;
  }

  unwrapGroup(fragment: CanvasFragment): CanvasNode[] {
    return fragment.children;
  }

  append(
    parent: CanvasContainer,
    child: CanvasNode | CanvasNode[]
  ): CanvasNode {
    append(parent, child);
    return parent;
  }

  createGroupHandle(group: CanvasFragment): CanvasRange {
    const handleStart = new CanvasAnchor();
    const handleEnd = new CanvasAnchor();
    group.prepend(handleStart);
    group.append(handleEnd);
    return [handleStart, handleEnd];
  }

  write(handle: CanvasRange, newContent: CanvasNode[]) {
    write(handle, newContent);
    this.#requestRender();
  }

  reconcile(handle: CanvasRange, options: ReconcilerOptions<CanvasNode>) {
    write(handle, collectReconciledNodes(options));
    this.#requestRender();
  }

  handleComponent(
    tagnameOrFunction: __HMR_UpdatableFn,
    props: any[]
  ): CanvasNode | CanvasNode[] {
    const template = tagnameOrFunction(...props);
    const nodes = createNodesFromTemplate(template, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  isActive(node: CanvasNode): boolean {
    let current: CanvasNode | null = node;
    while (current) {
      if (current === this.#root) return true;
      current = current.parent;
    }
    return false;
  }

  // Stubs.
  save(): number {
    throw new Error('Not implemented');
  }

  restore() {
    throw new Error('Not implemented');
  }
}

export async function renderToCanvasContext(
  ctx: CanvasRenderingContext2D,
  App: () => JSX.Template
) {
  App;
  const host = new CanvasHost(ctx);
  const renderer = new CanvasRenderer(host);
  setActiveRenderer(renderer);
  renderer.render(App);
  await runPendingSetupEffects();
  return renderer;
}

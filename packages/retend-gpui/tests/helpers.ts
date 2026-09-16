import { setActiveRenderer } from 'retend';

import { RetendGpuiRenderer } from '../source/gpui-renderer';

export interface RendererOptions {
  hmr?: boolean;
}

export interface DebugNode {
  id: number;
  kind:
    | 'Root'
    | 'Container'
    | 'Anchored'
    | 'Text'
    | 'Image'
    | 'Input'
    | 'Textarea'
    | 'Button';
  parent: number | null;
  children: number[];
  text: string | null;
  src: string | null;
}

export interface DebugTree {
  root_id: number;
  poisoned: boolean;
  pending_detached: number[];
  nodes: DebugNode[];
}

const renderers = new Set<RetendGpuiRenderer>();

export function createRenderer(
  options: RendererOptions = {}
): RetendGpuiRenderer {
  const renderer = new RetendGpuiRenderer({ ...options, headless: true });
  renderer.init();
  setActiveRenderer(renderer);
  renderers.add(renderer);
  return renderer;
}

export function disposeRenderers(): void {
  for (const renderer of renderers) renderer.dispose();
  renderers.clear();
}

export function debugTree(renderer: RetendGpuiRenderer): DebugTree {
  renderer.flush();
  return renderer.host.debugTree() as DebugTree;
}

export function nodeMap(tree: DebugTree): Map<number, DebugNode> {
  return new Map(tree.nodes.map((node) => [node.id, node]));
}

export function collectText(tree: DebugTree): string[] {
  const nodes = nodeMap(tree);
  const text: string[] = [];
  const visit = (id: number): void => {
    const node = nodes.get(id);
    if (!node) return;
    if (node.kind === 'Text') text.push(node.text ?? '');
    for (const child of node.children) visit(child);
  };
  visit(tree.root_id);
  return text;
}

export function idsByKind(tree: DebugTree, kind: DebugNode['kind']): number[] {
  return tree.nodes.filter((node) => node.kind === kind).map((node) => node.id);
}

export const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

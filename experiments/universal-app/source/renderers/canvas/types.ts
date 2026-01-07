import type { JSX } from 'retend/jsx-runtime';

export interface CanvasNodeProps {
  style?: JSX.Style;
  onClick?: (e: unknown) => void;
  [key: string]: unknown;
}

export type CanvasNode = {
  type: string;
  parent: CanvasNode | null;
  children: CanvasNode[];
  x: number;
  y: number;
  width: number;
  height: number;
  props: CanvasNodeProps;
  draw(ctx: CanvasRenderingContext2D): void;
  measure(ctx: CanvasRenderingContext2D, availableWidth?: number, availableHeight?: number): void;
};

export type CanvasTextNode = CanvasNode & {
  text: string;
};

export type CanvasContainerNode = CanvasNode;

export type CanvasHandle = [CanvasNode, CanvasNode];

export type CanvasRendererTypes = {
  Output: CanvasNode;
  Node: CanvasNode;
  Text: CanvasTextNode;
  Handle: CanvasHandle;
  Group: CanvasNode[];
  Container: CanvasContainerNode;
  Host: HTMLCanvasElement;
  SavedNodeState: unknown;
};

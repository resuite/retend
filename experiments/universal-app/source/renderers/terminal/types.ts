import type { JSX } from 'retend/jsx-runtime';
import type { TextNode } from './renderer';

export interface TerminalNodeProps {
  style?: JSX.Style;
  onClick?: (e: unknown) => void;
}

export interface ITerminalScreen {
  width: number;
  height: number;
  render(): void;
}

export interface TerminalNode {
  type: string;
  parent: TerminalNode | null;
  children: TerminalNode[];
  // Layout
  x: number;
  y: number;
  width: number;
  height: number;

  props: TerminalNodeProps;

  measure(availableWidth?: number, availableHeight?: number): void;
  paint(screen: ITerminalScreen): void;
  syncToBlessedWidget(screen: ITerminalScreen): void;

  // For cleaning up
  destroy(): void;
}

export interface TerminalTextNode extends TerminalNode {
  text: string;
}

export type TerminalContainerNode = TerminalNode;

export type TerminalHandle = [TerminalNode, TerminalNode];

export type TerminalRendererTypes = {
  // biome-ignore lint/suspicious/noExplicitAny: explicit any for renderer interface
  Output: any;
  Node: TerminalNode;
  Text: TextNode;
  Handle: TerminalHandle;
  Group: TerminalNode[];
  Container: TerminalContainerNode;
  Host: EventTarget;
  SavedNodeState: unknown;
};

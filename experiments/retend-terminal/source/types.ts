export type ValueOrCell<T> = T | import("@adbl/cells").Cell<T>;

export interface TerminalStyle {
	width?: ValueOrCell<number>;
	height?: ValueOrCell<number>;
	padding?: ValueOrCell<number>;
	flexDirection?: ValueOrCell<"row" | "column">;
	alignItems?: ValueOrCell<"flex-start" | "center" | "flex-end">;
	justifyContent?: ValueOrCell<
		"flex-start" | "center" | "flex-end" | "space-between"
	>;
	backgroundColor?: ValueOrCell<string>;
	color?: ValueOrCell<string>;
	borderColor?: ValueOrCell<string>;
    maxWidth?: ValueOrCell<number>;
	fontSize?: ValueOrCell<number>;
	fontWeight?: ValueOrCell<string>;
	fontFamily?: ValueOrCell<string>;
	textAlign?: ValueOrCell<"left" | "center" | "right">;
	textDecoration?: ValueOrCell<"none" | "underline">;
	whiteSpace?: ValueOrCell<"normal" | "nowrap">;
	position?: ValueOrCell<"absolute" | "relative">;
	top?: ValueOrCell<number>;
	left?: ValueOrCell<number>;
	right?: ValueOrCell<number>;
	bottom?: ValueOrCell<number>;
	columnGap?: ValueOrCell<number>;
	rowGap?: ValueOrCell<number>;
}

export interface TerminalNodeProps {
	style?: TerminalStyle;
	onClick?: (e: unknown) => void;
	// biome-ignore lint/suspicious/noExplicitAny: generic props
	[key: string]: any;
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
	Text: TerminalTextNode;
	Handle: TerminalHandle;
	Group: TerminalNode[];
	Container: TerminalContainerNode;
	Host: EventTarget; // The screen object wrapped or extending EventTarget
	SavedNodeState: unknown;
};

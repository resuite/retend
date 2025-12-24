type ValueOrCell<T> = T | import("@adbl/cells").Cell<T>;

export interface CanvasStyle {
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

export interface CanvasNodeProps {
	style?: CanvasStyle;
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
	measure(ctx: CanvasRenderingContext2D, availableWidth?: number): void;
};

export type CanvasTextNode = CanvasNode & {
	text: string;
};

export type CanvasContainerNode = CanvasNode;

export type CanvasHandle = [CanvasNode, CanvasNode]; // Start and end markers (comments/sentinels)

export type CanvasRendererTypes = {
	Output: CanvasNode; // The renderer draws directly to canvas, but returns the root node for reference
	Node: CanvasNode;
	Text: CanvasTextNode;
	Handle: CanvasHandle;
	Group: CanvasNode[]; // Retend generally uses DocumentFragment for Group, but array of nodes is also common for custom renderers
	Container: CanvasContainerNode;
	Host: HTMLCanvasElement;
	SavedNodeState: unknown;
};

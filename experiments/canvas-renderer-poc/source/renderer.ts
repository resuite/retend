import type {
	CanvasRendererTypes,
	CanvasNode,
	CanvasTextNode,
	CanvasContainerNode,
	CanvasHandle,
	CanvasNodeProps,
} from "./types";
import { createNodesFromTemplate, Cell } from "retend";
import type { ReconcilerOptions } from "retend";

function getValue<T>(value: T | Cell<T>): T {
	return value instanceof Cell ? value.get() : value;
}

class BaseNode implements CanvasNode {
	type = "node";
	parent: CanvasNode | null = null;
	children: CanvasNode[] = [];
	x = 0;
	y = 0;
	width = 0;
	height = 0;
	props: CanvasNodeProps = {};

	constructor(type: string, props: CanvasNodeProps = {}) {
		this.type = type;
		this.props = props;
	}

	measure(_ctx: CanvasRenderingContext2D, _availableWidth?: number) {
		const style = this.props.style || {};
		this.width = getValue(style.width) || 0;
		this.height = getValue(style.height) || 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx;
	}
}

class BoxNode extends BaseNode implements CanvasContainerNode {
	measure(ctx: CanvasRenderingContext2D, availableWidth?: number) {
		const style = this.props.style || {};
		const isRoot = this.type === "root";

		if (style.width !== undefined) {
			this.width = getValue(style.width);
		} else {
			this.width = 0;
		}

		if (style.height !== undefined) {
			this.height = getValue(style.height);
		} else {
			this.height = 0;
		}

		const flexDirection = getValue(style.flexDirection) || "column";
		const padding =
			getValue(style.padding) || (this.type === "button" ? 10 : 0);

		let totalChildWidth = 0;
		let totalChildHeight = 0;
		let maxChildWidth = 0;
		let maxChildHeight = 0;

		let childAvailableWidth: number | undefined;
		if (this.width) {
			childAvailableWidth = this.width - padding * 2;
		} else if (isRoot && style.width) {
			childAvailableWidth = getValue(style.width) - padding * 2;
		} else if (availableWidth) {
			childAvailableWidth = availableWidth - padding * 2;
		}

		// First pass: Measure children (grouping text nodes)
		let i = 0;
		while (i < this.children.length) {
			const child = this.children[i];
			if (child.type === "text-inner") {
				// Find consecutive text nodes
				let j = i + 1;
				// biome-ignore lint/suspicious/noExplicitAny: internal text node access
				const first = child as any;
				let combinedText = first.text;
				const group = [first];

				while (j < this.children.length && this.children[j].type === "text-inner") {
					// biome-ignore lint/suspicious/noExplicitAny: internal text node access
					const sibling = this.children[j] as any;
					combinedText += sibling.text;
					group.push(sibling);
					j++;
				}

				if (group.length > 1) {
					const originalText = first.text;
					first.text = combinedText;
					first.measure(ctx, childAvailableWidth);
					first.text = originalText;

					// Clear siblings
					for (let k = 1; k < group.length; k++) {
						const sibling = group[k];
						sibling.width = 0;
						sibling.height = 0;
						sibling.lines = [];
					}
					i = j;
					continue;
				}
			}

			child.measure(ctx, childAvailableWidth);
			i++;
		}

		// Second pass: Accumulate layout stats
		for (const child of this.children) {
			const childStyle = child.props.style || {};
			if (getValue(childStyle.position) === "absolute") continue;

			if (flexDirection === "column") {
				totalChildHeight += child.height;
				maxChildWidth = Math.max(maxChildWidth, child.width);
			} else {
				totalChildWidth += child.width;
				maxChildHeight = Math.max(maxChildHeight, child.height);
			}
		}

		// Auto-sizing (only if not explicit)
		if (!this.width && !isRoot) {
			if (flexDirection === "column") {
				this.width = maxChildWidth + padding * 2;
			} else {
				this.width = totalChildWidth + padding * 2;
			}
		}

		if (!this.height && !isRoot) {
			if (flexDirection === "column") {
				this.height = totalChildHeight + padding * 2;
			} else {
				this.height = maxChildHeight + padding * 2;
			}
		}

		// Default min size for empty boxes
		if (!this.width && !isRoot) this.width = 0;
		if (!this.height && !isRoot) this.height = 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const style = this.props.style || {};

		let fillStyle = getValue(style.backgroundColor) || "transparent";
		if (fillStyle === "transparent" && this.type === "button") {
			fillStyle = "#e0e0e0";
		}

		if (fillStyle !== "transparent") {
			ctx.fillStyle = fillStyle;
			ctx.fillRect(this.x, this.y, this.width, this.height);
		}

		// Border support
		const borderColor = getValue(style.borderColor);
		if (borderColor) {
			ctx.strokeStyle = borderColor;
			ctx.lineWidth = 2;
			ctx.strokeRect(this.x, this.y, this.width, this.height);
		} else if (this.type === "button") {
			ctx.strokeStyle = "#999";
			ctx.strokeRect(this.x, this.y, this.width, this.height);
		}

		// Layout Config
		const flexDirection = getValue(style.flexDirection) || "column";
		const alignItems = getValue(style.alignItems) || "flex-start";
		const justifyContent = getValue(style.justifyContent) || "flex-start";
		const padding =
			getValue(style.padding) || (this.type === "button" ? 10 : 0);

		// Available space
		const availWidth = this.width - padding * 2;
		const availHeight = this.height - padding * 2;

		// Calculate total children extent for justification (excluding absolute)
		let totalChildExtent = 0;
		const flowChildren = this.children.filter(
			(c) => getValue(c.props.style?.position) !== "absolute",
		);

		if (flexDirection === "column") {
			totalChildExtent = flowChildren.reduce((acc, c) => acc + c.height, 0);
		} else {
			totalChildExtent = flowChildren.reduce((acc, c) => acc + c.width, 0);
		}

		let startOffset = 0;
		if (justifyContent === "center") {
			const axisSize = flexDirection === "column" ? availHeight : availWidth;
			startOffset = (axisSize - totalChildExtent) / 2;
		} else if (justifyContent === "flex-end") {
			const axisSize = flexDirection === "column" ? availHeight : availWidth;
			startOffset = axisSize - totalChildExtent;
		}

		let currentX = this.x + padding;
		let currentY = this.y + padding;

		if (flexDirection === "column") {
			currentY += startOffset;
		} else {
			currentX += startOffset;
		}

		// Gap support
		const columnGap = getValue(style.columnGap) || 0;
		const rowGap = getValue(style.rowGap) || 0;
		const gap = flexDirection === "row" ? columnGap : rowGap;

		for (const child of this.children) {
			const childStyle = child.props.style || {};

			if (childStyle.position === "absolute") {
				const left =
					childStyle.left !== undefined ? getValue(childStyle.left) : 0;
				const top = childStyle.top !== undefined ? getValue(childStyle.top) : 0;

				child.x = this.x + left;
				child.y = this.y + top;

				child.draw(ctx);
				continue;
			}

			// Alignment (Cross Axis)
			let childX = currentX;
			let childY = currentY;

			if (flexDirection === "column") {
				// Cross axis is X
				if (alignItems === "center") {
					childX = this.x + padding + (availWidth / 2 - child.width / 2);
				} else if (alignItems === "flex-end") {
					childX = this.x + this.width - padding - child.width;
				} else {
					childX = this.x + padding; // flex-start
				}

				// Main axis placement
				childY = currentY;
				currentY += child.height + gap;
			} else {
				// row
				// Cross axis is Y
				if (alignItems === "center") {
					childY = this.y + padding + (availHeight / 2 - child.height / 2);
				} else if (alignItems === "flex-end") {
					childY = this.y + this.height - padding - child.height;
				} else {
					childY = this.y + padding;
				}

				// Main axis placement
				childX = currentX;
				currentX += child.width + gap;
			}

			child.x = childX;
			child.y = childY;

			// Recursive draw
			child.draw(ctx);
		}
	}
}

class TextNodeInner extends BaseNode implements CanvasTextNode {
	text: string;
	lines: string[] = [];
	lineHeight = 0;

	constructor(text: string) {
		super("text-inner");
		this.text = text;
	}

	getResolvedStyle() {
		// Text nodes usually sit inside a container (like <text> or <button>) that holds the styles.
		// We need to look up to the parent to find text-related styles.
		const myStyle = this.props.style || {};
		const parentStyle =
			this.parent &&
			(this.parent.type === "text" || this.parent.type === "button")
				? this.parent.props.style || {}
				: {};

		return {
			...parentStyle,
			...myStyle,
		};
	}

	getFont() {
		const style = this.getResolvedStyle();
		const fontSize = getValue(style.fontSize) || 16;
		const fontWeight = getValue(style.fontWeight) || "normal";
		const fontFamily = getValue(style.fontFamily) || "sans-serif";

		return `${fontWeight} ${fontSize}px ${fontFamily}`;
	}

	measure(ctx: CanvasRenderingContext2D, availableWidth?: number) {
		const style = this.getResolvedStyle();
		ctx.font = this.getFont();

		const textStr = String(this.text);
		const fontSize = getValue(style.fontSize) || 16;
		this.lineHeight = fontSize * 1.2;
		const whiteSpace = getValue(style.whiteSpace) || "normal";

		if (!availableWidth || whiteSpace === "nowrap") {
			// No constraint or nowrap, single line
			const metrics = ctx.measureText(textStr);
			this.width = metrics.width;
			this.height = this.lineHeight;
			this.lines = [textStr];
			return;
		}

		// Word Wrapping Logic
		const words = textStr.split(" ");
		let currentLine = words[0];
		this.lines = [];
		let maxWidth = 0;

		for (let i = 1; i < words.length; i++) {
			const word = words[i];
			const width = ctx.measureText(`${currentLine} ${word}`).width;
			if (width < availableWidth) {
				currentLine += ` ${word}`;
			} else {
				this.lines.push(currentLine);
				maxWidth = Math.max(maxWidth, ctx.measureText(currentLine).width);
				currentLine = word;
			}
		}
		this.lines.push(currentLine);
		maxWidth = Math.max(maxWidth, ctx.measureText(currentLine).width);

		this.width = maxWidth;
		this.height = this.lines.length * this.lineHeight;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const style = this.getResolvedStyle();
		ctx.fillStyle = getValue(style.color) || "black";
		ctx.font = this.getFont();
		ctx.textBaseline = "top"; // Easier for multi-line layout

		const textAlign = getValue(style.textAlign) || "left";
		ctx.textAlign = textAlign;
		
		const textDecoration = getValue(style.textDecoration);
		const isUnderline = textDecoration === "underline";

		let yOffset = 0;
		for (const line of this.lines) {
			let xPos = this.x;
			if (textAlign === "center") {
				xPos = this.x + this.width / 2;
			} else if (textAlign === "right") {
				xPos = this.x + this.width;
			}

			ctx.fillText(line, xPos, this.y + yOffset);
			
			// Draw underline if textDecoration is 'underline'
			if (isUnderline) {
				const lineWidth = ctx.measureText(line).width;
				let underlineX = xPos;
				if (textAlign === "center") {
					underlineX = xPos - lineWidth / 2;
				} else if (textAlign === "right") {
					underlineX = xPos - lineWidth;
				}
				ctx.beginPath();
				ctx.strokeStyle = getValue(style.color) || "black";
				ctx.lineWidth = 1;
				ctx.moveTo(underlineX, this.y + yOffset + this.lineHeight - 2);
				ctx.lineTo(underlineX + lineWidth, this.y + yOffset + this.lineHeight - 2);
				ctx.stroke();
			}
			
			yOffset += this.lineHeight;
		}
		// Reset alignment for other nodes
		ctx.textAlign = "left";
	}
}

class MarkerNode extends BaseNode {
	constructor(public name: string) {
		super("marker");
	}
	draw() {}
}

export class CanvasRenderer {
	host: CanvasRendererTypes["Host"];
	ctx: CanvasRenderingContext2D;
	root: BoxNode;
	capabilities = {
		supportsSetupEffects: true,
		supportsObserverConnectedCallbacks: false,
	};
	observer = null;

	constructor(canvas: HTMLCanvasElement) {
		this.host = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Could not get 2d context");
		this.ctx = ctx;

		// Root node
		this.root = new BoxNode("root");
		// Root sizing handled in render

		this.render();
	}

	requestRender() {
		requestAnimationFrame(() => this.render());
	}

	render() {
		const { width, height } = this.host;
		this.ctx.clearRect(0, 0, width, height);

		this.root.width = width;
		this.root.height = height;

		// Measure Pass
		this.root.measure(this.ctx, width);

		// Force root size back to canvas size
		this.root.width = width;
		this.root.height = height;

		// Layout & Draw Pass
		this.root.draw(this.ctx);
	}

	// Renderer Interface Implementation

	isActive(_node: CanvasNode): boolean {
		return true;
	}

	onViewChange(_processor: () => void) {}

	selectMatchingNodes(_key: string) {
		return [];
	}
	selectMatchingNode(_key: string) {
		return null;
	}
	saveContainerState() {
		return null;
	}
	restoreContainerState() {}

	createGroupHandle(group: CanvasNode[]): CanvasHandle {
		const start = new MarkerNode("start");
		const end = new MarkerNode("end");
		group.unshift(start);
		group.push(end);
		return [start, end];
	}

	write(handle: CanvasHandle, newContent: CanvasNode[]) {
		const [start, end] = handle;
		const parent = start.parent;
		if (!parent) return;

		const startIndex = parent.children.indexOf(start);
		const endIndex = parent.children.indexOf(end);

		if (startIndex === -1 || endIndex === -1) return;

		// Remove old
		parent.children.splice(startIndex + 1, endIndex - startIndex - 1);

		// Insert new
		for (const n of newContent) {
			n.parent = parent;
		}
		parent.children.splice(startIndex + 1, 0, ...newContent);

		this.requestRender();
	}

	reconcile(handle: CanvasHandle, options: ReconcilerOptions<CanvasNode>) {
		// "Just rerender" strategy: collect all nodes from the new cache in order.
		const allNodes: CanvasNode[] = [];
		let i = 0;
		for (const item of options.newList) {
			const key = options.retrieveOrSetItemKey(item, i++);
			const cached = options.newCache.get(key);
			if (cached) {
				allNodes.push(...cached.nodes);
			}
		}
		this.write(handle, allNodes);
	}

	setProperty<N extends CanvasNode>(node: N, key: string, value: unknown): N {
		if (Cell.isCell(value)) {
			const cell = value as Cell<unknown>;
			const update = (val: unknown) => {
				this.setProperty(node, key, val);
			};
			cell.listen(update);
			update(cell.get());
			return node;
		}

		if (key === "style" && typeof value === "object" && value !== null) {
			// biome-ignore lint/suspicious/noExplicitAny: casting for merge
			node.props.style = { ...node.props.style, ...(value as any) };
		} else if (key.startsWith("on")) {
			node.props[key] = value;
			if (key === "onClick") {
				const handler = (e: MouseEvent) => {
					const rect = this.host.getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					if (
						x >= node.x &&
						x <= node.x + node.width &&
						y >= node.y &&
						y <= node.y + node.height
					) {
						if (typeof value === "function") {
							value(e);
						}
						this.requestRender();
					}
				};
				this.host.addEventListener("click", handler);
			}
		} else {
			node.props[key] = value;
		}
		this.requestRender();
		return node;
	}

	// biome-ignore lint/suspicious/noExplicitAny: Retend interface compliance
	handleComponent(tagname: any, props: any): CanvasNode | CanvasNode[] {
		// @ts-ignore
		const component = tagname(props);
		const nodes = createNodesFromTemplate(component, this) as CanvasNode[];
		return nodes.length === 1 ? nodes[0] : nodes;
	}

	append(parent: CanvasNode, child: CanvasNode | CanvasNode[]) {
		if (Array.isArray(child)) {
			for (const c of child) {
				c.parent = parent;
				parent.children.push(c);
			}
		} else {
			child.parent = parent;
			parent.children.push(child);
		}
		this.requestRender();
		return parent;
	}

	handlePromise(child: Promise<unknown>) {
		const placeholder = new MarkerNode("promise-placeholder");
		child.then((_res) => {
			// placeholder logic
		});
		return placeholder;
	}

	updateText(text: string, node: CanvasTextNode) {
		node.text = text;
		this.requestRender();
		return node;
	}

	finalize(node: CanvasNode) {
		return node;
	}

	createGroup(input?: CanvasNode | CanvasNode[]) {
		if (!input) return [];
		return Array.isArray(input) ? input : [input];
	}

	unwrapGroup(group: CanvasNode[]) {
		return group;
	}

	createContainer(tagname: string, props: CanvasNodeProps) {
		return new BoxNode(tagname, props);
	}

	createText(text: string | Cell<unknown>) {
		if (Cell.isCell(text)) {
			const initial = text.get();
			const node = new TextNodeInner(
				typeof initial === "string" || typeof initial === "number"
					? String(initial)
					: "",
			);
			text.listen((val) => {
				node.text =
					typeof val === "string" || typeof val === "number" ? String(val) : "";
				this.requestRender();
			});
			return node;
		}
		return new TextNodeInner(String(text));
	}

	isGroup(node: unknown): node is CanvasNode[] {
		return Array.isArray(node);
	}

	isNode(child: unknown): child is CanvasNode {
		return child instanceof BaseNode;
	}
}

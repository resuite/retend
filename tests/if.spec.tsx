import { Cell, If, getActiveRenderer } from "retend";
import type { VNode } from "retend-server/v-dom";
import type { DOMRenderer } from "retend-web";
import { describe, expect, it } from "vitest";
import {
	type NodeLike,
	browserSetup,
	getTextContent,
	vDomSetup,
} from "./setup.tsx";

const runTests = () => {
	it("should render truthy branch when condition is true", () => {
		const renderer = getActiveRenderer();
		const App = () => If(true, () => <div>True</div>);
		const result = renderer.render(App) as NodeLike;
		expect(getTextContent(result)).toBe("True");
	});

	it("should render falsy branch when condition is false", () => {
		const renderer = getActiveRenderer();
		const App = () =>
			If(
				false,
				() => <div>True</div>,
				() => <div>False</div>,
			);
		const result = renderer.render(App) as NodeLike;
		expect(getTextContent(result)).toBe("False");
	});

	it("should render nothing when condition is false and no falsy branch provided", () => {
		const renderer = getActiveRenderer();
		const App = () => If(false, () => <div>True</div>);
		const result = renderer.render(App) as NodeLike;
		expect(getTextContent(result)).toBe("");
	});

	it("should work with Cell conditions", () => {
		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;
		const condition = Cell.source(true);
		const App = () => (
			<div id="test-node">
				{If(
					condition,
					() => (
						<div>True</div>
					),
					() => (
						<div>False</div>
					),
				)}
			</div>
		);
		const result = renderer.render(App) as NodeLike;

		window.document.body.append(result as Node & VNode);

		expect(result instanceof window.HTMLElement).toBe(true);
		expect(result.childNodes[0] instanceof window.Comment).toBe(true);
		expect(getTextContent(result)).toBe("True");
		expect(result.childNodes[2] instanceof window.Comment).toBe(true);

		condition.set(false);
		// // The DOM should automatically update due to cell reactivity
		expect(getTextContent(result)).toBe("False");
	});

	it("should accept an object with true/false branches", () => {
		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;
		const App = () =>
			If(true, {
				true: () => <div>True</div>,
				false: () => <div>False</div>,
			});
		const result = renderer.render(App) as NodeLike;
		expect(result instanceof window.HTMLElement).toBe(true);
		expect(result.childNodes[0].textContent).toBe("True");
	});

	it("should handle nested If statements", () => {
		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;
		const outer = Cell.source(true);
		const inner = Cell.source(false);

		const App = () => (
			<div>
				{If(outer, () =>
					If(
						inner,
						() => <div>Both True</div>,
						() => <div>Outer True, Inner False</div>,
					),
				)}
			</div>
		);
		const result = renderer.render(App) as HTMLElement;

		expect(result instanceof window.HTMLElement).toBe(true);
		expect(getTextContent(result)).toBe("Outer True, Inner False");

		inner.set(true);
		expect(getTextContent(result)).toBe("Both True");
	});

	it("should handle falsy values properly", () => {
		const renderer = getActiveRenderer();
		const values = [false, 0, "", null, undefined];
		for (const value of values) {
			const App = () =>
				If(
					value as boolean | null | undefined,
					() => <div>True</div>,
					() => <div>False</div>,
				);
			const result = renderer.render(App) as NodeLike;
			expect(getTextContent(result)).toBe("False");
		}
	});

	it("should handle truthy values properly", () => {
		const renderer = getActiveRenderer();
		const values = [true, 1, "hello", [], {}];
		for (const value of values) {
			const App = () => (
				<div>
					{If(
						value,
						() => (
							<div>True</div>
						),
						() => (
							<div>False</div>
						),
					)}
				</div>
			);
			const result = renderer.render(App) as NodeLike;
			expect(getTextContent(result)).toBe("True");
		}
	});
};

describe("If", () => {
	describe("Browser", () => {
		browserSetup();
		runTests();
	});

	describe("VDom", () => {
		vDomSetup();
		runTests();
	});
});

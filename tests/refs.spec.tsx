import { describe, it, expect, vi } from "vitest";
import { Cell, getActiveRenderer } from "retend";
import type { DOMRenderer } from "retend-web";
import { browserSetup, vDomSetup } from "./setup.tsx";
import type { VNode } from "retend/v-dom";

const runTests = () => {
	it("should assign a ref to an element", () => {
		const elementRef = Cell.source<HTMLElement | null>(null);
		const element = <div ref={elementRef}>Hello, world!</div>;

		expect(elementRef.peek()).toBe(element);
	});

	it("should work with functional components", () => {
		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;
		const elementRef = Cell.source<HTMLElement | null>(null);
		const callback = vi.fn();

		const MyComponent = () => {
			return <div ref={elementRef}>Hello, world!</div>;
		};

		const element = (<MyComponent />) as unknown as HTMLElement & VNode;

		expect(elementRef.peek()).toBe(element);
		expect(elementRef.peek()).toBeInstanceOf(window.HTMLElement);

		elementRef.listen(callback);
		const newInstance = <MyComponent />;
		expect(callback).toHaveBeenCalledTimes(1);
		expect(elementRef.peek()).toBe(newInstance);
	});
};

describe("Refs", () => {
	describe("Browser", () => {
		browserSetup();
		runTests();
	});

	describe("VDom", () => {
		vDomSetup();
		runTests();
	});
});

import { Cell, If, getActiveRenderer, runPendingSetupEffects } from "retend";
import type { DOMRenderer } from "retend-web";
import { describe, expect, it, vi } from "vitest";
import { useWindowEventListener } from "../../packages/retend-utils/source/hooks";
import { browserSetup } from "../setup.tsx";

describe("useWindowEventListener", () => {
	browserSetup();

	it("should add event listener and call callback on event", async () => {
		const callback = vi.fn();
		useWindowEventListener("resize", callback);
		await runPendingSetupEffects();

		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;

		window.dispatchEvent(new Event("resize"));

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(expect.any(Event));
	});

	it("should pass options to addEventListener", async () => {
		const callback = vi.fn();
		const addSpy = vi.spyOn(window, "addEventListener");

		useWindowEventListener("scroll", callback, { passive: true });
		await runPendingSetupEffects();

		expect(addSpy).toHaveBeenCalledWith("scroll", callback, { passive: true });
	});

	it("should remove event listener on cleanup", async () => {
		const show = Cell.source(true);
		const callback = vi.fn();
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const Component = () => {
			useWindowEventListener("resize", callback);
			return <div>test</div>;
		};

		const App = () => <div>{If(show, Component)}</div>;

		const renderer = getActiveRenderer() as DOMRenderer;
		renderer.render(App);
		await runPendingSetupEffects();

		show.set(false);

		expect(removeSpy).toHaveBeenCalledWith("resize", callback, undefined);
	});

	it("should properly type event parameter based on event name", async () => {
		let receivedEvent: MouseEvent | undefined;

		useWindowEventListener("click", (event) => {
			receivedEvent = event;
		});
		await runPendingSetupEffects();

		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;

		const clickEvent = new MouseEvent("click", { clientX: 100, clientY: 200 });
		window.dispatchEvent(clickEvent);

		expect(receivedEvent).toBe(clickEvent);
		expect(receivedEvent?.clientX).toBe(100);
	});

	it("should not add listener if renderer is not DOMRenderer", async () => {
		const { setActiveRenderer } = await import("retend");
		const { VDOMRenderer } = await import("retend-server/v-dom");
		const { VWindow } = await import("retend-server/v-dom");
		const { setGlobalContext } = await import("retend/context");

		setGlobalContext({
			globalData: new Map(),
			teleportIdCounter: { value: 0 },
		});
		setActiveRenderer(new VDOMRenderer(new VWindow()));

		const callback = vi.fn();
		useWindowEventListener("resize", callback);

		expect(callback).not.toHaveBeenCalled();
	});
});

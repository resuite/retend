import { Cell, If, onConnected } from "retend";
import { type DOMRenderer, Teleport } from "retend-web";
import type { JSX } from "retend/jsx-runtime";
import { describe, expect, it, vi } from "vitest";
import { browserSetup, timeout } from "../setup.tsx";
import {
	createHydrationClientRenderer,
	renderHydrationServerHtml,
	startHydration as startHydrationFlow,
} from "./hydration-helpers.tsx";

const setupHydrationRenderer = async (templateFn: () => JSX.Template) => {
	const html = await renderHydrationServerHtml(templateFn);
	return createHydrationClientRenderer(html);
};

const startHydration = (
	renderer: DOMRenderer,
	templateFn: () => JSX.Template,
) => {
	startHydrationFlow(renderer, templateFn);
};

describe("Hydration onConnected flushing", () => {
	browserSetup();

	it("flushes root onConnected callbacks before child hydration gate resolves", async () => {
		const mounted = vi.fn();
		const template = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, mounted);
			return (
				<div id="root-observer">
					<button id="root-observer-btn" ref={ref} type="button">
						Ready
					</button>
				</div>
			);
		};

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);

		expect(mounted).toHaveBeenCalledTimes(1);

		await renderer.endHydration();
	});

	it("flushes multiple callbacks in the same hydration commit", async () => {
		const mountedA = vi.fn();
		const mountedB = vi.fn();
		const template = () => {
			const firstRef = Cell.source<HTMLElement | null>(null);
			const secondRef = Cell.source<HTMLElement | null>(null);
			onConnected(firstRef, mountedA);
			onConnected(secondRef, mountedB);
			return (
				<section id="multi-observer">
					<button id="multi-a" ref={firstRef} type="button">
						A
					</button>
					<button id="multi-b" ref={secondRef} type="button">
						B
					</button>
				</section>
			);
		};

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);

		expect(mountedA).toHaveBeenCalledTimes(1);
		expect(mountedB).toHaveBeenCalledTimes(1);

		await renderer.endHydration();
	});

	it("flushes nested component callbacks before hydration completes", async () => {
		const mounted = vi.fn();
		const Child = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, mounted);
			return (
				<div id="nested-observer-node" ref={ref}>
					Child
				</div>
			);
		};
		const template = () => (
			<div id="nested-observer-root">
				<Child />
			</div>
		);

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);

		expect(mounted).toHaveBeenCalledTimes(1);

		await renderer.endHydration();
	});

	it("flushes callbacks in hydrated control-flow branches", async () => {
		const show = Cell.source(true);
		const mounted = vi.fn();
		const template = () => (
			<div id="if-observer-root">
				{If(show, {
					true: () => {
						const ref = Cell.source<HTMLElement | null>(null);
						onConnected(ref, mounted);
						return (
							<p id="if-observer-node" ref={ref}>
								Visible
							</p>
						);
					},
					false: () => null,
				})}
			</div>
		);

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);

		expect(mounted).toHaveBeenCalledTimes(1);

		await renderer.endHydration();
	});

	it("flushes teleported callbacks during teleport hydration mount", async () => {
		const mounted = vi.fn();
		const TeleportedContent = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, mounted);
			return (
				<button id="teleport-observer-node" ref={ref} type="button">
					Teleported
				</button>
			);
		};
		const template = () => (
			<div id="teleport-observer-root">
				<div id="teleport-observer-target" />
				<Teleport to="#teleport-observer-target">
					<TeleportedContent />
				</Teleport>
			</div>
		);

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);
		expect(mounted).toHaveBeenCalledTimes(0);

		await renderer.endHydration();
		await timeout(0);
		expect(mounted).toHaveBeenCalledTimes(1);
	});

	it("flushes callbacks for multiple teleports before hydration fully settles", async () => {
		const callOrder: string[] = [];
		const FirstTeleported = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, () => {
				callOrder.push("first");
			});
			return (
				<button id="teleport-first-node" ref={ref} type="button">
					First
				</button>
			);
		};
		const SecondTeleported = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, () => {
				callOrder.push("second");
			});
			return (
				<button id="teleport-second-node" ref={ref} type="button">
					Second
				</button>
			);
		};
		const template = () => (
			<div id="teleport-multi-root">
				<div id="teleport-multi-target" />
				<Teleport to="#teleport-multi-target">
					<FirstTeleported />
				</Teleport>
				<Teleport to="#teleport-multi-target">
					<SecondTeleported />
				</Teleport>
			</div>
		);

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);

		await renderer.endHydration();
		await timeout(0);
		expect(callOrder).toEqual(["first", "second"]);
	});

	it("uses endHydration as a final safety flush for queued refs", async () => {
		const template = () => (
			<div id="final-flush-root">
				<div id="final-flush-target">Target</div>
			</div>
		);
		const { renderer, document } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);

		const ref = Cell.source<HTMLElement | null>(null);
		const mounted = vi.fn();
		onConnected(ref, mounted);
		ref.set(document.querySelector("#final-flush-target"));
		await timeout(0);
		expect(mounted).toHaveBeenCalledTimes(0);

		await renderer.endHydration();
		expect(mounted).toHaveBeenCalledTimes(1);
	});

	it("does not duplicate callbacks across commit flush and final safety flush", async () => {
		const mounted = vi.fn();
		const template = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, mounted);
			return (
				<div id="dedupe-root">
					<button id="dedupe-node" ref={ref} type="button">
						Dedupe
					</button>
				</div>
			);
		};

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);
		await timeout(0);
		expect(mounted).toHaveBeenCalledTimes(1);

		await renderer.endHydration();
		expect(mounted).toHaveBeenCalledTimes(1);
	});

	it("does not duplicate teleported callbacks across per-teleport and final flushes", async () => {
		const mounted = vi.fn();
		const TeleportedContent = () => {
			const ref = Cell.source<HTMLElement | null>(null);
			onConnected(ref, mounted);
			return (
				<button id="teleport-dedupe-node" ref={ref} type="button">
					Teleported
				</button>
			);
		};
		const template = () => (
			<div id="teleport-dedupe-root">
				<div id="teleport-dedupe-target" />
				<Teleport to="#teleport-dedupe-target">
					<TeleportedContent />
				</Teleport>
			</div>
		);

		const { renderer } = await setupHydrationRenderer(template);
		startHydration(renderer, template);

		await renderer.endHydration();
		await timeout(0);
		expect(mounted).toHaveBeenCalledTimes(1);
	});
});

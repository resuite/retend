import { describe, it, expect, vi } from "vitest";
import { getActiveRenderer } from "retend";
import type { DOMRenderer } from "retend-web";
import { createWebRouter, defineRoutes } from "retend/router";
import { vDomSetup, getTextContent, routerRoot } from "../setup.tsx";

describe("beforenavigate event", () => {
	vDomSetup();

	it("beforenavigate event is dispatched before navigation", async () => {
		const listener = vi.fn();
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });

		router.addEventListener("beforenavigate", listener);

		await router.navigate("/");
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].detail.from).toBeUndefined();
		expect(listener.mock.calls[0][0].detail.to).toBe("/");

		await router.navigate("/about");
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[1][0].detail.from).toBe("/");
		expect(listener.mock.calls[1][0].detail.to).toBe("/about");

		router.removeEventListener("beforenavigate", listener);
	});

	it("beforenavigate event can be prevented to cancel navigation", async () => {
		const renderer = getActiveRenderer() as DOMRenderer;
		const { host: window } = renderer;
		const listener = vi.fn((event) => {
			if (event.detail.to === "/about") {
				event.preventDefault();
			}
		});
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });
		router.attachWindowListeners(window);
		window.document.body.append(routerRoot(router));

		router.addEventListener("beforenavigate", listener);

		await router.navigate("/");
		expect(getTextContent(window.document.body)).toBe("Home");

		await router.navigate("/about");
		expect(getTextContent(window.document.body)).toBe("Home"); // Navigation prevented

		router.removeEventListener("beforenavigate", listener);
	});

	it("beforenavigate event is dispatched in replace()", async () => {
		const listener = vi.fn();
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });

		router.addEventListener("beforenavigate", listener);

		await router.navigate("/");
		expect(listener).toHaveBeenCalledTimes(1);

		router.replace("/about");
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[1][0].detail.from).toBe("/");
		expect(listener.mock.calls[1][0].detail.to).toBe("/about");

		router.removeEventListener("beforenavigate", listener);
	});
});

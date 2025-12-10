import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { getGlobalContext } from "retend/context";
import { createWebRouter, defineRoutes } from "retend/router";
import { vDomSetup, getTextContent, routerRoot } from "../setup.tsx";

describe("router.lock()", () => {
	vDomSetup();

	it("should prevent navigation when locked", async () => {
		const { window } = getGlobalContext();

		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });
		router.attachWindowListeners(window);
		window.document.body.append(routerRoot(router));

		await router.navigate("/");
		expect(getTextContent(window.document.body)).toBe("Home");

		router.lock();
		await router.navigate("/about");

		expect(getTextContent(window.document.body)).toBe("Home");

		router.unlock();
		await router.navigate("/about");

		expect(getTextContent(window.document.body)).toBe("About");
	});

	it("should prevent navigation when window.location is changed while locked", async () => {
		const { window } = getGlobalContext();
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });
		router.attachWindowListeners(window);
		window.document.body.append(routerRoot(router));

		await router.navigate("/");
		expect(getTextContent(window.document.body)).toBe("Home");

		router.lock();
		window.history.pushState({}, "", "/about");
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(getTextContent(window.document.body)).toBe("Home");

		router.unlock();
		window.history.pushState({}, "", "/about");
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(getTextContent(window.document.body)).toBe("About");
	});

	it("routelockprevented event is dispatched when navigation is prevented by lock", async () => {
		const listener = vi.fn();
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });

		router.addEventListener("routelockprevented", listener);

		await router.navigate("/");
		router.lock();
		await router.navigate("/about");

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].detail.attemptedPath).toBe("/about");

		router.unlock();
		router.removeEventListener("routelockprevented", listener);
	});

	it("routelockprevented event is dispatched in replace() when navigation is prevented by lock", async () => {
		const { window } = getGlobalContext();
		const listener = vi.fn();
		const Home = () => <div>Home</div>;
		const About = () => <div>About</div>;

		const routes = defineRoutes([
			{ name: "home", path: "/", component: Home },
			{ name: "about", path: "/about", component: About },
		]);

		const router = createWebRouter({ routes });
		router.attachWindowListeners(window);

		router.addEventListener("routelockprevented", listener);

		await router.navigate("/");
		router.lock();
		await router.replace("/about");

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].detail.attemptedPath).toBe("/about");

		router.unlock();
		router.removeEventListener("routelockprevented", listener);
	});
});

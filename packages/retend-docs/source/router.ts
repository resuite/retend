import { Router } from "retend/router";
import { MainLayout } from "./layouts/MainLayout";
import { Home } from "./routes/Home";
import { FeaturesPage } from "./routes/FeaturesPage";
import { QuickstartPage } from "./routes/QuickstartPage";

export function createRouter() {
	const router = new Router({
		routes: [
			{
				path: "/",
				component: MainLayout,
				children: [
					{
						path: "/",
						component: Home,
					},
					{
						path: "/features",
						component: FeaturesPage,
					},
					{
						path: "/quickstart",
						component: QuickstartPage,
					},
				],
			},
		],
	});

	if (typeof window !== "undefined") {
		router.attachWindowListeners(window);
	}

	return router;
}

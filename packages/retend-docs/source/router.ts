import { MainLayout } from "@/layouts/MainLayout";
import { FeaturesPage } from "@/routes/FeaturesPage";
import { Home } from "@/routes/Home";
import { QuickstartPage } from "@/routes/QuickstartPage";
import { Router } from "retend/router";

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

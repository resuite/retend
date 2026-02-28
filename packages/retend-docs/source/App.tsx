import { createRouter } from "@/router";
import { createRouterRoot } from "retend/router";
import "./index.css";

export function App() {
	const router = createRouter();
	return createRouterRoot(router);
}

import { createRouterRoot } from "retend/router";
import { createRouter } from "./router";
import "./index.css";

export function App() {
	const router = createRouter();
	return createRouterRoot(router);
}

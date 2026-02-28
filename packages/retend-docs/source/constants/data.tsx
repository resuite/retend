export interface Feature {
	id: string;
	title: string;
	description: string;
}

export interface QuickstartStep {
	id: string;
	title: string;
	detail: string;
	command: string;
}

export const FEATURES: Feature[] = [
	{
		id: "composable",
		title: "Modular Primitives",
		description:
			"Assemble complex views from atomic, predictable units of logic.",
	},
	{
		id: "reactive",
		title: "Direct Reactivity",
		description:
			"State changes map directly to DOM mutations. No virtual overhead.",
	},
	{
		id: "performance",
		title: "Surgical Updates",
		description:
			"Change only what is necessary, keeping interactions fluid and responsive.",
	},
	{
		id: "routing",
		title: "Native Routing",
		description:
			"Built-in routing primitives that manage navigation and deep links.",
	},
	{
		id: "async",
		title: "Async First",
		description:
			"Deeply integrated async patterns for tasks, pending states, and errors.",
	},
	{
		id: "typescript",
		title: "TypeScript Native",
		description:
			"Typed APIs ensure reliability from small prototypes to large systems.",
	},
];

export const QUICKSTART_STEPS: QuickstartStep[] = [
	{
		id: "01",
		title: "Install",
		detail: "Initialize a new project with the CLI.",
		command: "pnpm create retend-app",
	},
	{
		id: "02",
		title: "Run",
		detail: "Spin up the local development environment.",
		command: "pnpm dev",
	},
	{
		id: "03",
		title: "Build",
		detail: "Compile for production deployment.",
		command: "pnpm build",
	},
];

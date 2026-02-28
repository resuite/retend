import { For } from "retend";
import { FEATURES } from "../constants/data";
import {
	ComposableIcon,
	ReactiveIcon,
	PerformanceIcon,
	RoutingIcon,
	AsyncIcon,
	TypescriptIcon,
} from "../icons";

export function FeaturesPage() {
	const icons: Record<string, ReturnType<typeof ComposableIcon>> = {
		composable: <ComposableIcon />,
		reactive: <ReactiveIcon />,
		performance: <PerformanceIcon />,
		routing: <RoutingIcon />,
		async: <AsyncIcon />,
		typescript: <TypescriptIcon />,
	};

	return (
		<section id="features">
			<div class="mb-12 max-w-[640px]">
				<span class="mb-4 block font-mono text-xs uppercase tracking-widest text-brand">
					The Framework
				</span>
				<h2 class="mb-5 text-[2rem] leading-tight tracking-tight text-fg">
					Built for precision.
				</h2>
				<p class="text-lg text-fg-muted">
					A specialized toolkit designed for building performance-critical user interfaces.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-y-15 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
				{For(
					FEATURES,
					(feature) => (
						<article class="flex flex-col rounded-xl border border-border bg-white p-8 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)] transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand hover:shadow-[-5px_5px_0px_0px_rgba(15,23,42,0.35)]">
							<div class="mb-6 text-brand [&_svg]:h-8 [&_svg]:w-8">{icons[feature.id]}</div>
							<h3 class="mb-3 text-[1.2rem] tracking-tight text-fg">{feature.title}</h3>
							<p class="text-fg-muted leading-relaxed">{feature.description}</p>
						</article>
					),
					{ key: "id" },
				)}
			</div>
		</section>
	);
}

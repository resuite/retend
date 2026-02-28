import { For } from "retend";
import { QUICKSTART_STEPS } from "../constants/data";

export function QuickstartPage() {
	return (
		<section id="quickstart">
			<div class="mb-12 max-w-[640px]">
				<span class="mb-4 block font-mono text-xs uppercase tracking-widest text-brand">
					Get Started
				</span>
				<h2 class="mb-5 text-[2rem] leading-tight tracking-tight text-fg">
					Zero to production.
				</h2>
				<p class="text-lg text-fg-muted">
					Onboarding is fast. Retend stays close to modern TypeScript workflows.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-y-15 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
				{For(
					QUICKSTART_STEPS,
					(step) => (
						<article class="flex flex-col rounded-xl border border-border bg-white p-8 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)] transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand hover:shadow-[-5px_5px_0px_0px_rgba(15,23,42,0.35)]">
							<span class="mb-3 block font-mono text-[0.8rem] text-brand">{step.id}</span>
							<h3 class="mb-3 text-[1.2rem] tracking-tight text-fg">{step.title}</h3>
							<p class="text-fg-muted leading-relaxed">{step.detail}</p>
							<code class="mt-6 border-l-2 border-brand pl-4 font-mono text-xs text-fg">{step.command}</code>
						</article>
					),
					{ key: "id" },
				)}
			</div>
		</section>
	);
}

export function ValueProp() {
	return (
		<section>
			<div class="mb-12 max-w-[640px]">
				<span class="mb-4 block font-mono text-xs uppercase tracking-widest text-brand">
					Core Principles
				</span>
				<h2 class="mb-5 text-[2rem] leading-tight tracking-tight text-fg">
					Direct to DOM.
				</h2>
				<p class="text-lg text-fg-muted">
					Retend maps state changes directly to DOM mutations.
					By eliminating the virtual diffing layer, your application logic
					executes with surgical precision and minimal memory overhead.
				</p>
			</div>

			<div class="mt-16 grid grid-cols-1 gap-y-15 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
				<div class="flex flex-col rounded-xl border border-border bg-white p-8 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)] transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand hover:shadow-[-5px_5px_0px_0px_rgba(15,23,42,0.35)]">
					<h3 class="mb-3 text-xl tracking-tight text-brand">Fine-grained</h3>
					<p class="text-fg-muted leading-relaxed">Updates target specific nodes, not component trees.</p>
				</div>
				<div class="flex flex-col rounded-xl border border-border bg-white p-8 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)] transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand hover:shadow-[-5px_5px_0px_0px_rgba(15,23,42,0.35)]">
					<h3 class="mb-3 text-xl tracking-tight text-brand">Declarative</h3>
					<p class="text-fg-muted leading-relaxed">Express complex logic through pure functional primitives.</p>
				</div>
				<div class="flex flex-col rounded-xl border border-border bg-white p-8 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)] transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand hover:shadow-[-5px_5px_0px_0px_rgba(15,23,42,0.35)]">
					<h3 class="mb-3 text-xl tracking-tight text-brand">Lightweight</h3>
					<p class="text-fg-muted leading-relaxed">A small runtime that stays out of your way.</p>
				</div>
			</div>
		</section>
	);
}

import { Card } from "@/components/Card";
import { FeatureCard } from "@/components/FeatureCard";
import { SectionHeader } from "@/components/SectionHeader";
import { QUICKSTART_STEPS } from "@/constants/data";
import { For } from "retend";

export function QuickstartPage() {
	return (
		<section id="quickstart">
			<SectionHeader
				label="Get Started"
				title="Zero to production."
				description="Onboarding is fast. Retend stays close to modern TypeScript workflows."
			/>

			<div class="grid grid-cols-1 gap-y-15 md:grid-cols-3 md:gap-x-12 md:gap-y-16">
				{For(
					QUICKSTART_STEPS,
					(step) => (
						<Card interactive class="p-8">
							<FeatureCard
								id={step.id}
								title={step.title}
								description={step.detail}
							/>
							<code class="mt-6 border-l-2 border-brand pl-4 font-mono text-xs text-fg">
								{step.command}
							</code>
						</Card>
					),
					{ key: "id" },
				)}
			</div>
		</section>
	);
}

import { Cell, If } from "retend";
import type { JSX } from "retend/jsx-runtime";
import { useDerivedValue } from "retend-utils/hooks";

export interface FeatureCardProps {
	id?: JSX.ValueOrCell<string>;
	title: JSX.ValueOrCell<string>;
	description: JSX.ValueOrCell<string | JSX.Element>;
	icon?: JSX.ValueOrCell<JSX.Element>;
	class?: JSX.ValueOrCell<string | string[] | object>;
}

export function FeatureCard(props: FeatureCardProps) {
	const { id, title, description, icon, class: className, ...rest } = props;

	const evaluatedId = useDerivedValue(id);
	const evaluatedIcon = useDerivedValue(icon);

	const hasIcon = Cell.derived(() => evaluatedIcon.get() != null);
	const hasId = Cell.derived(() => evaluatedId.get() != null);

	return (
		<div class={["flex flex-col", className]} {...rest}>
			{If(hasIcon, () => (
				<div class="mb-6 text-brand [&_svg]:h-8 [&_svg]:w-8">{icon}</div>
			))}
			{If(hasId, () => (
				<span class="mb-3 block font-mono text-[0.8rem] text-brand">{id}</span>
			))}
			<h3 class="mb-3 text-[1.2rem] tracking-tight text-fg">{title}</h3>
			<p class="text-fg-muted leading-relaxed">{description}</p>
		</div>
	);
}

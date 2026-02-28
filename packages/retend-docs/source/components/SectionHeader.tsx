
import type { JSX } from "retend/jsx-runtime";

export interface SectionHeaderProps {
	label: JSX.ValueOrCell<string>;
	title: JSX.ValueOrCell<string>;
	description: JSX.ValueOrCell<string | JSX.Element>;
	class?: JSX.ValueOrCell<string | string[] | object>;
}

export function SectionHeader(props: SectionHeaderProps) {
	const { label, title, description, class: className, ...rest } = props;

	return (
		<div class={["mb-12 max-w-[640px]", className]} {...rest}>
			<span class="mb-4 block font-mono text-xs uppercase tracking-widest text-brand">
				{label}
			</span>
			<h2 class="mb-5 text-[2rem] leading-tight tracking-tight text-fg">
				{title}
			</h2>
			<p class="text-lg text-fg-muted">{description}</p>
		</div>
	);
}

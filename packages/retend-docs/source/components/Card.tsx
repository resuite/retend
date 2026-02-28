import type { JSX } from "retend/jsx-runtime";
import { Cell } from "retend";
import { useDerivedValue } from "retend-utils/hooks";

export interface CardProps {
	interactive?: JSX.ValueOrCell<boolean>;
	class?: JSX.ValueOrCell<string | string[] | object>;
	"aria-label"?: JSX.ValueOrCell<string>;
	children?: JSX.Children;
}

export function Card(props: CardProps) {
	const { interactive, class: className, children, ...rest } = props;

	const baseClasses =
		"rounded-xl border-[2px] border-natural-100 border-border bg-white";

	const isInteractive = useDerivedValue(interactive);
	const interactiveClasses = Cell.derived(() =>
		isInteractive.get()
			? "transition-all hover:translate-x-px hover:-translate-y-px hover:border-brand"
			: "",
	);

	return (
		<div class={[baseClasses, interactiveClasses, className]} {...rest}>
			{children}
		</div>
	);
}

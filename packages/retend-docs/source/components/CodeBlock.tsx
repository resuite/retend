import { Cell } from "retend";
import { createHighlighter } from "shiki";
import { Card } from "./Card";

const highlighterPromise = createHighlighter({
	themes: ["github-light"],
	langs: ["tsx"],
});

interface CodeBlockProps {
	code: string;
	lang: string;
	class?: string | string[] | object;
}

export function CodeBlock(props: CodeBlockProps) {
	const { code, lang, class: className } = props;

	const html = Cell.derivedAsync(async () => {
		const highlighter = await highlighterPromise;
		return highlighter.codeToHtml(code, { lang, theme: "github-light" });
	});

	return (
		<Card class={["p-5", className]} aria-label="Code sample">
			<div
				class="[&_.shiki]:overflow-x-auto [&_.shiki]:!bg-transparent [&_pre]:!bg-transparent [&_code]:font-mono [&_code]:text-[0.8rem] [&_code]:leading-relaxed"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</Card>
	);
}

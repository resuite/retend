import { Cell } from 'retend';
import { createHighlighter } from 'shiki';

const highlighterPromise = createHighlighter({
  themes: ['github-light'],
  langs: ['tsx'],
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
    return highlighter.codeToHtml(code, { lang, theme: 'github-light' });
  });

  return (
    <aside
      class={['rounded-xl border border-border bg-white p-5 shadow-[-3px_3px_0px_0px_rgba(15,23,42,0.25)]', className]}
      aria-label="Code sample"
    >
      <div class="[&_.shiki]:overflow-x-auto [&_.shiki]:!bg-transparent [&_pre]:!bg-transparent [&_code]:font-mono [&_code]:text-[0.8rem] [&_code]:leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
}

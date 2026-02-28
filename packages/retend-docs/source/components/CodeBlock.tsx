import { Cell } from 'retend';
import { useHighlighter } from '@/scopes/highlighter';
import { Card } from './Card';

interface CodeBlockProps {
  code: string;
  lang: string;
  class?: string | string[] | object;
}

export function CodeBlock(props: CodeBlockProps) {
  const { code, lang, class: className } = props;
  const highlighterPromise = useHighlighter();

  const html = Cell.derivedAsync(async () => {
    const highlighter = await highlighterPromise;
    return highlighter.codeToHtml(code, { lang, theme: 'retend-theme' });
  });

  return (
    <Card class={['p-6', className]} aria-label="Code sample">
      <div
        class="[&_.shiki]:overflow-x-auto [&_.shiki]:!bg-transparent [&_code]:font-mono [&_code]:text-[0.8rem] [&_code]:leading-relaxed [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Card>
  );
}

import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';

import { useHighlighter } from '@/scopes/highlighter';

import { Card } from './Card';

type CodeBlockContainerProps = JSX.BaseContainerProps & {
  class?: string | string[] | object;
};

type CodeBlockContainer = (props: CodeBlockContainerProps) => JSX.Element;

interface CodeBlockProps {
  code: string;
  lang: string;
  class?: string | string[] | object;
  container?: CodeBlockContainer;
  containerProps?: CodeBlockContainerProps;
}

export function CodeBlock(props: CodeBlockProps) {
  const {
    code,
    lang,
    class: className,
    container: Container = Card,
    containerProps,
  } = props;
  const highlighterPromise = useHighlighter();

  const html = Cell.derivedAsync(async () => {
    const highlighter = await highlighterPromise;
    return highlighter.codeToHtml(code, { lang, theme: 'retend-theme' });
  });

  const { class: containerClassName, ...restContainerProps } =
    containerProps ?? {};

  return (
    <Container
      class={['p-5 sm:p-6', className, containerClassName]}
      aria-label="Code sample"
      {...restContainerProps}
    >
      <div
        class="[&_.shiki]:overflow-x-auto [&_.shiki]:!bg-transparent [&_code]:font-mono [&_code]:text-[0.75rem] [&_code]:leading-relaxed sm:[&_code]:text-[0.8rem] [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Container>
  );
}

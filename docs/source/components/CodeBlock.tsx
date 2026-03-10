import type { JSX } from 'retend/jsx-runtime';

import { highlightCode } from '@/utils/tsxHighlighter';

import { Card } from './Card';

type CodeBlockContainer = (props: JSX.BaseContainerProps) => JSX.Element;

interface CodeBlockProps {
  code: string;
  lang: string;
  class?: string | string[] | object;
  container?: CodeBlockContainer;
  containerProps?: JSX.BaseContainerProps;
}

export function CodeBlock(props: CodeBlockProps) {
  const {
    code,
    lang,
    class: className,
    container: Container = Card,
    containerProps,
  } = props;
  const html = highlightCode(code, lang);

  const { class: containerClassName, ...restContainerProps } =
    containerProps ?? {};

  return (
    <Container
      class={['p-5 sm:p-6', className, containerClassName]}
      aria-label="Code sample"
      {...restContainerProps}
    >
      <div class="overflow-x-auto">
        <pre class="rt-code-block rt-code-pre">
          <code
            class="rt-code-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      </div>
    </Container>
  );
}

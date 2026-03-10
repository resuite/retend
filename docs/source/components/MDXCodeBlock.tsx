import type { JSX } from 'retend/jsx-runtime';

import { highlightCode } from '@/utils/tsxHighlighter';

type MDXCodeBlockContainerProps = JSX.BaseContainerProps;

function MDXCodeBlockContainer(props: MDXCodeBlockContainerProps) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={['border-border bg-surface min-w-0 rounded-xl border', className]}
      {...rest}
    />
  );
}

interface MDXCodeBlockProps {
  code: string;
  lang: string;
  class?: string | string[] | object;
  containerProps?: JSX.BaseContainerProps;
}

export function MDXCodeBlock(props: MDXCodeBlockProps) {
  const { code, lang, class: className, containerProps } = props;
  const html = highlightCode(code, lang);

  const { class: containerClassName, ...restContainerProps } =
    containerProps ?? {};

  return (
    <MDXCodeBlockContainer
      class={['px-5 py-4 sm:p-5', className, containerClassName]}
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
    </MDXCodeBlockContainer>
  );
}

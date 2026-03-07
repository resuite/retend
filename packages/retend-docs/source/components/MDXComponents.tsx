import { JSX } from 'retend/jsx-runtime';

import { CodeBlock } from '@/components/CodeBlock';
import { InlineCode } from '@/components/InlineCode';

type MdxComponentOptions = {
  nextHeadingId?: (depth: 2 | 3) => string | undefined;
};

export function createMDXComponents(options: MdxComponentOptions = {}) {
  const { nextHeadingId } = options;

  return {
    code: (props: JSX.IntrinsicElements['code']) => {
      const text = props.children as string;
      if (props.class) {
        const className = String(props.class);
        if (className.includes('language-')) {
          return <CodeBlock code={text} lang={className.split('-')[1]} />;
        }
      }
      const mdxClassName = Reflect.get(props, 'className');
      if (mdxClassName) {
        const className = String(mdxClassName);
        if (className.includes('language-')) {
          return <CodeBlock code={text} lang={className.split('-')[1]} />;
        }
      }
      return <InlineCode class={props.class}>{props.children}</InlineCode>;
    },
    h1: (props: JSX.IntrinsicElements['h1']) => (
      <h1 class="text-fg mt-0 mb-5 scroll-mt-6 text-4xl tracking-tight">
        {props.children}
      </h1>
    ),
    h2: (props: JSX.IntrinsicElements['h2']) => {
      const { class: className, children, ...rest } = props;
      let headingId: string | undefined;
      if (nextHeadingId) {
        headingId = nextHeadingId(2);
      }
      return (
        <h2
          id={headingId}
          class={[
            'text-fg mt-10 mb-4 scroll-mt-6 scroll-mt-24 text-3xl tracking-tight',
            className,
          ]}
          {...rest}
        >
          {children}
        </h2>
      );
    },
    h3: (props: JSX.IntrinsicElements['h3']) => {
      const { class: className, children, ...rest } = props;
      let headingId: string | undefined;
      if (nextHeadingId) {
        headingId = nextHeadingId(3);
      }
      return (
        <h3
          id={headingId}
          class={[
            'text-fg mt-8 mb-3 scroll-mt-6 text-2xl tracking-tight',
            className,
          ]}
          {...rest}
        >
          {children}
        </h3>
      );
    },
    h4: (props: JSX.IntrinsicElements['h4']) => (
      <h4 class="text-fg mt-7 mb-2 scroll-mt-6 text-xl tracking-tight">
        {props.children}
      </h4>
    ),
    p: (props: JSX.IntrinsicElements['p']) => (
      <p class="text-fg my-4 leading-7">{props.children}</p>
    ),
    a: (props: JSX.IntrinsicElements['a']) => (
      <a
        href={props.href}
        class="text-brand hover:text-brand-dark underline underline-offset-4"
      >
        {props.children}
      </a>
    ),
    ul: (props: JSX.IntrinsicElements['ul']) => (
      <ul class="my-4 list-disc pl-6">{props.children}</ul>
    ),
    ol: (props: JSX.IntrinsicElements['ol']) => (
      <ol class="my-4 list-decimal pl-6">{props.children}</ol>
    ),
    li: (props: JSX.IntrinsicElements['li']) => (
      <li class="my-1 leading-7">{props.children}</li>
    ),
    blockquote: (props: JSX.IntrinsicElements['blockquote']) => (
      <blockquote class="border-brand text-fg-muted my-6 border-l-3 pl-4">
        {props.children}
      </blockquote>
    ),
    hr: () => <hr class="border-border/30 my-6 border-0 border-t" />,
    pre: (props: JSX.IntrinsicElements['pre']) => <pre>{props.children}</pre>,
    table: (props: JSX.IntrinsicElements['table']) => (
      <table class="border-border my-6 w-full border-collapse text-sm">
        {props.children}
      </table>
    ),
    th: (props: JSX.IntrinsicElements['th']) => (
      <th class="border-border bg-surface-alt text-fg border px-3 py-2 text-left font-semibold">
        {props.children}
      </th>
    ),
    td: (props: JSX.IntrinsicElements['td']) => (
      <td class="border-border text-fg border px-3 py-2">{props.children}</td>
    ),
  };
}

import { CodeBlock } from '@/components/CodeBlock';

interface CopyableCodeBlockProps {
  code: string;
  lang: string;
}

export function CopyableCodeBlock(props: CopyableCodeBlockProps) {
  const { code, lang } = props;

  return (
    <div class="my-5">
      <div class="mb-2 flex justify-end">
        <button
          type="button"
          class="border-border bg-surface-alt hover:bg-surface-alt-hover text-fg rounded border px-2.5 py-1 text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(code);
          }}
        >
          Copy
        </button>
      </div>
      <CodeBlock code={code} lang={lang} />
    </div>
  );
}

import { MDXCodeBlock } from '@/components/MDXCodeBlock';

interface CopyableCodeBlockProps {
  code: string;
  lang: string;
}

export function CopyableCodeBlock(props: CopyableCodeBlockProps) {
  const { code, lang } = props;

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
  };

  return (
    <div class="my-5">
      <div class="mb-2 flex justify-end">
        <button
          type="button"
          class="border-border bg-surface-alt hover:bg-surface-alt-hover text-fg rounded border px-2.5 py-1 text-xs"
          onClick={handleCopy}
        >
          Copy
        </button>
      </div>
      <MDXCodeBlock code={code} lang={lang} />
    </div>
  );
}

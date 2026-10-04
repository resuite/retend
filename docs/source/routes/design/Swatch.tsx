import { Cell, If, onConnected } from 'retend';

import { contrastRatio } from '@/ds/contrast';

interface SwatchProps {
  token: string;
  /** Background token to measure against. Omit for a plain color chip. */
  against?: string;
  /** Minimum ratio: 4.5 for text, 3 for UI and large elements. */
  need?: 3 | 4.5;
}

function criterionLabel(need: 3 | 4.5 | undefined): string {
  if (need === 4.5) return 'Text 4.5:1';
  if (need === 3) return 'UI 3:1';
  return '';
}

/**
 * Reads the live CSS variables from the panel it sits in, so each theme is
 * measured from the values actually rendered, not from a copy in TypeScript.
 */
export function Swatch(props: SwatchProps) {
  const { token, against, need } = props;
  const rootRef = Cell.source<HTMLDivElement | null>(null);
  const hex = Cell.source('');
  const ratio = Cell.source('');
  const verdict = Cell.source('');
  const isPass = Cell.derived(() => verdict.get() === 'Pass');
  const isFail = Cell.derived(() => verdict.get() === 'Fail');

  onConnected(rootRef, (element) => {
    const styles = getComputedStyle(element);
    const foreground = styles.getPropertyValue(`--ds-${token}`).trim();
    const background = against
      ? styles.getPropertyValue(`--ds-${against}`).trim()
      : '';
    const value = need ? contrastRatio(foreground, background) : null;

    Cell.batch(() => {
      hex.set(foreground);
      if (value === null || need === undefined) return;
      ratio.set(`${value.toFixed(2)}:1`);
      verdict.set(value >= need ? 'Pass' : 'Fail');
    });
  });

  const criterion = criterionLabel(need);
  const chipStyle = {
    backgroundColor: `var(--ds-${against ?? token})`,
    color: `var(--ds-${token})`,
  };

  return (
    <div ref={rootRef} class="flex items-center gap-3">
      <div
        style={chipStyle}
        class="border-line-strong text-small grid size-11 shrink-0 place-items-center rounded-md border font-semibold"
      >
        {If(against, () => (
          <span>Aa</span>
        ))}
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-caption text-ink truncate font-mono">{token}</p>
        <p class="text-caption text-ink-faint font-mono">{hex}</p>
      </div>
      <div class="text-caption text-right">
        <p class="text-ink-soft font-mono">{ratio}</p>
        <p class="text-ink-faint">{criterion}</p>
        <p class={['font-medium', { 'text-good': isPass, 'text-bad': isFail }]}>
          {verdict}
        </p>
      </div>
    </div>
  );
}

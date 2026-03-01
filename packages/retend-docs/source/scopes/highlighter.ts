import type { Highlighter } from 'shiki';

import { createScope, useScopeContext } from 'retend';

interface HighlighterContext {
  highlighter: Promise<Highlighter>;
}

export const HighlighterScope =
  createScope<HighlighterContext>('docs:Highlighter');

export function useHighlighter(): Promise<Highlighter> {
  return useScopeContext(HighlighterScope).highlighter;
}

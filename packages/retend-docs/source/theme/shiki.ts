import type { ThemeInput } from 'shiki';

export const retendTheme: ThemeInput = {
  name: 'retend-theme',
  type: 'light',
  colors: {
    'editor.foreground': 'var(--color-retend-fg)',
    'editor.background': 'transparent', // Let the Card handle background
    'editor.selectionBackground': 'var(--color-retend-surface-alt-hover)',
    'editor.lineHighlightBackground': 'var(--color-retend-surface-alt)',
    'editorCursor.foreground': 'var(--color-retend-brand)',
    'editorWhitespace.foreground': 'var(--color-retend-border)',
  },
  settings: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
        fontStyle: 'italic',
      },
    },
    {
      scope: [
        'constant',
        'entity.name.constant',
        'variable.other.constant',
        'variable.other.enummember',
        'variable.language',
      ],
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: ['entity', 'entity.name'],
      settings: {
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'variable.parameter.function',
      settings: {
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: 'entity.name.tag',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'keyword',
      settings: {
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: ['storage', 'storage.type'],
      settings: {
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: [
        'storage.modifier.package',
        'storage.modifier.import',
        'storage.type.java',
      ],
      settings: {
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: [
        'string',
        'punctuation.definition.string',
        'string punctuation.section.embedded source',
      ],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: 'support',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'meta.property-name',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'variable',
      settings: {
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: 'variable.other',
      settings: {
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: 'invalid.broken',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'invalid.deprecated',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'invalid.illegal',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'invalid.unimplemented',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'carriage-return',
      settings: {
        fontStyle: 'italic underline',
        background: 'var(--color-retend-brand-dark)',
        foreground: 'var(--color-retend-bg)',
      },
    },
    {
      scope: 'message.error',
      settings: {
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: 'string variable',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: ['source.regexp', 'string.regexp'],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: [
        'string.regexp.character-class',
        'string.regexp constant.character.escape',
        'string.regexp source.ruby.embedded',
        'string.regexp string.regexp.arbitrary-repitition',
      ],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: 'string.regexp constant.character.escape',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'support.constant',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'support.variable',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'meta.module-reference',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'punctuation.definition.list.begin.markdown',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: ['markup.heading', 'markup.heading entity.name'],
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'markup.quote',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'markup.italic',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: 'markup.bold',
      settings: {
        foreground: 'var(--color-retend-fg)',
      },
    },
    {
      scope: ['markup.underline'],
      settings: {
        fontStyle: 'underline',
      },
    },
    {
      scope: ['markup.strikethrough'],
      settings: {
        fontStyle: 'strikethrough',
      },
    },
    {
      scope: 'markup.inline.raw',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: [
        'markup.deleted',
        'meta.diff.header.from-file',
        'punctuation.definition.deleted',
      ],
      settings: {
        background: 'var(--color-retend-brand-soft)',
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: [
        'markup.inserted',
        'meta.diff.header.to-file',
        'punctuation.definition.inserted',
      ],
      settings: {
        background: 'var(--color-retend-surface-alt)',
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: ['markup.changed', 'punctuation.definition.changed'],
      settings: {
        background: 'var(--color-retend-brand-soft)',
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: ['markup.ignored', 'markup.untracked'],
      settings: {
        foreground: 'var(--color-retend-surface)',
        background: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: 'meta.diff.range',
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: 'meta.diff.header',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'meta.separator',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: 'meta.output',
      settings: {
        foreground: 'var(--color-retend-brand)',
      },
    },
    {
      scope: [
        'brackethighlighter.tag',
        'brackethighlighter.curly',
        'brackethighlighter.round',
        'brackethighlighter.square',
        'brackethighlighter.angle',
        'brackethighlighter.quote',
      ],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
      },
    },
    {
      scope: 'brackethighlighter.unmatched',
      settings: {
        foreground: 'var(--color-retend-brand-dark)',
      },
    },
    {
      scope: ['constant.other.reference.link', 'string.other.link'],
      settings: {
        foreground: 'var(--color-retend-fg-muted)',
        fontStyle: 'underline',
      },
    },
  ],
};

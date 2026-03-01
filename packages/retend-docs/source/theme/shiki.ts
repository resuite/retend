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
        foreground: 'var(--color-retend-code-comment)',
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
        foreground: 'var(--color-retend-code-number)',
      },
    },
    {
      scope: ['entity', 'entity.name'],
      settings: {
        foreground: 'var(--color-retend-code-type)',
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
        foreground: 'var(--color-retend-code-property)',
      },
    },
    {
      scope: 'keyword',
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: ['storage', 'storage.type'],
      settings: {
        foreground: 'var(--color-retend-code-type)',
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
        foreground: 'var(--color-retend-code-string)',
      },
    },
    {
      scope: 'support',
      settings: {
        foreground: 'var(--color-retend-code-function)',
      },
    },
    {
      scope: 'meta.property-name',
      settings: {
        foreground: 'var(--color-retend-code-property)',
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
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'invalid.deprecated',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'invalid.illegal',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'invalid.unimplemented',
      settings: {
        fontStyle: 'italic',
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'carriage-return',
      settings: {
        fontStyle: 'italic underline',
        background: 'var(--color-retend-code-keyword)',
        foreground: 'var(--color-retend-bg)',
      },
    },
    {
      scope: 'message.error',
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'string variable',
      settings: {
        foreground: 'var(--color-retend-code-string)',
      },
    },
    {
      scope: ['source.regexp', 'string.regexp'],
      settings: {
        foreground: 'var(--color-retend-code-string)',
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
        foreground: 'var(--color-retend-code-string)',
      },
    },
    {
      scope: 'string.regexp constant.character.escape',
      settings: {
        foreground: 'var(--color-retend-code-number)',
      },
    },
    {
      scope: 'support.constant',
      settings: {
        foreground: 'var(--color-retend-code-number)',
      },
    },
    {
      scope: 'support.variable',
      settings: {
        foreground: 'var(--color-retend-code-property)',
      },
    },
    {
      scope: 'meta.module-reference',
      settings: {
        foreground: 'var(--color-retend-code-property)',
      },
    },
    {
      scope: 'punctuation.definition.list.begin.markdown',
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: ['markup.heading', 'markup.heading entity.name'],
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'markup.quote',
      settings: {
        foreground: 'var(--color-retend-code-comment)',
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
        fontStyle: 'normal',
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
        foreground: 'var(--color-retend-code-function)',
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
        foreground: 'var(--color-retend-code-keyword)',
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
        foreground: 'var(--color-retend-code-comment)',
      },
    },
    {
      scope: ['markup.changed', 'punctuation.definition.changed'],
      settings: {
        background: 'var(--color-retend-brand-soft)',
        foreground: 'var(--color-retend-code-number)',
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
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'meta.separator',
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
      },
    },
    {
      scope: 'meta.output',
      settings: {
        foreground: 'var(--color-retend-code-keyword)',
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
        foreground: 'var(--color-retend-code-type)',
      },
    },
    {
      scope: 'brackethighlighter.unmatched',
      settings: {
        foreground: 'var(--color-retend-code-number)',
      },
    },
    {
      scope: ['constant.other.reference.link', 'string.other.link'],
      settings: {
        foreground: 'var(--color-retend-code-property)',
        fontStyle: 'underline',
      },
    },
  ],
};

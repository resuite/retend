import type { ThemeInput } from 'shiki';

export const retendTheme: ThemeInput = {
  name: 'retend-theme',
  type: 'light',
  colors: {
    'editor.foreground': '#0f172a',
    'editor.background': '#ffffff',
    'editor.selectionBackground': '#e2e8f0',
    'editor.lineHighlightBackground': '#fafaf9',
    'editorCursor.foreground': '#9a3412',
    'editorWhitespace.foreground': '#bababa',
  },
  settings: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: {
        foreground: '#64748b',
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
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: ['entity', 'entity.name'],
      settings: {
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'variable.parameter.function',
      settings: {
        foreground: '#0f172a', // fg
      },
    },
    {
      scope: 'entity.name.tag',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'keyword',
      settings: {
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: ['storage', 'storage.type'],
      settings: {
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: [
        'storage.modifier.package',
        'storage.modifier.import',
        'storage.type.java',
      ],
      settings: {
        foreground: '#0f172a', // fg
      },
    },
    {
      scope: [
        'string',
        'punctuation.definition.string',
        'string punctuation.section.embedded source',
      ],
      settings: {
        foreground: '#64748b', // fg-muted
      },
    },
    {
      scope: 'support',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'meta.property-name',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'variable',
      settings: {
        foreground: '#0f172a', // fg
      },
    },
    {
      scope: 'variable.other',
      settings: {
        foreground: '#0f172a', // fg
      },
    },
    {
      scope: 'invalid.broken',
      settings: {
        fontStyle: 'italic',
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'invalid.deprecated',
      settings: {
        fontStyle: 'italic',
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'invalid.illegal',
      settings: {
        fontStyle: 'italic',
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'invalid.unimplemented',
      settings: {
        fontStyle: 'italic',
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'carriage-return',
      settings: {
        fontStyle: 'italic underline',
        background: '#7c2d12', // brand-dark
        foreground: '#ffffff',
      },
    },
    {
      scope: 'message.error',
      settings: {
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: 'string variable',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: ['source.regexp', 'string.regexp'],
      settings: {
        foreground: '#64748b', // fg-muted
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
        foreground: '#64748b', // fg-muted
      },
    },
    {
      scope: 'string.regexp constant.character.escape',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'support.constant',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'support.variable',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'meta.module-reference',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'punctuation.definition.list.begin.markdown',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: ['markup.heading', 'markup.heading entity.name'],
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'markup.quote',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'markup.italic',
      settings: {
        fontStyle: 'italic',
        foreground: '#0f172a', // fg
      },
    },
    {
      scope: 'markup.bold',
      settings: {
        foreground: '#0f172a', // fg
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
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: [
        'markup.deleted',
        'meta.diff.header.from-file',
        'punctuation.definition.deleted',
      ],
      settings: {
        background: '#fff7ed', // brand-soft
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: [
        'markup.inserted',
        'meta.diff.header.to-file',
        'punctuation.definition.inserted',
      ],
      settings: {
        background: '#f1f5f9', // surface-alt
        foreground: '#64748b', // fg-muted
      },
    },
    {
      scope: ['markup.changed', 'punctuation.definition.changed'],
      settings: {
        background: '#fff7ed', // brand-soft
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: ['markup.ignored', 'markup.untracked'],
      settings: {
        foreground: '#fafaf9', // surface
        background: '#64748b', // fg-muted
      },
    },
    {
      scope: 'meta.diff.range',
      settings: {
        foreground: '#64748b', // fg-muted
      },
    },
    {
      scope: 'meta.diff.header',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'meta.separator',
      settings: {
        foreground: '#9a3412', // brand
      },
    },
    {
      scope: 'meta.output',
      settings: {
        foreground: '#9a3412', // brand
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
        foreground: '#64748b', // fg-muted
      },
    },
    {
      scope: 'brackethighlighter.unmatched',
      settings: {
        foreground: '#7c2d12', // brand-dark
      },
    },
    {
      scope: ['constant.other.reference.link', 'string.other.link'],
      settings: {
        foreground: '#64748b', // fg-muted
        fontStyle: 'underline',
      },
    },
  ],
};

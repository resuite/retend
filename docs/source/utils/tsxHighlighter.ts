const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const BOOLEANS = new Set(['true', 'false']);

const BUILTINS = new Set([
  'console',
  'Math',
  'JSON',
  'document',
  'window',
  'process',
  'global',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Promise',
  'Set',
  'Map',
  'Date',
  'RegExp',
  'Error',
  'BigInt',
  'Symbol',
]);

const MAX_CACHE_ENTRIES = 64;
const TSX_CACHE = new Map<string, string>();
const SHELL_CACHE = new Map<string, string>();

function isWhitespaceCode(code: number): boolean {
  return (
    code === 32 ||
    code === 9 ||
    code === 10 ||
    code === 13 ||
    code === 11 ||
    code === 12
  );
}

function isIdentifierStartCode(code: number): boolean {
  return (
    code === 36 ||
    code === 95 ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isIdentifierPartCode(code: number): boolean {
  return isIdentifierStartCode(code) || (code >= 48 && code <= 57);
}

function isUppercaseLetterCode(code: number): boolean {
  return code >= 65 && code <= 90;
}

function pushEscaped(
  out: string[],
  source: string,
  start: number,
  end: number
): void {
  let cursor = start;
  for (let i = start; i < end; i += 1) {
    const code = source.charCodeAt(i);
    if (code !== 38 && code !== 60 && code !== 62) continue;

    if (cursor < i) out.push(source.slice(cursor, i));
    if (code === 38) out.push('&amp;');
    if (code === 60) out.push('&lt;');
    if (code === 62) out.push('&gt;');
    cursor = i + 1;
  }

  if (cursor < end) out.push(source.slice(cursor, end));
}

function pushWrappedToken(
  out: string[],
  className: string,
  source: string,
  start: number,
  end: number
): void {
  out.push('<span class="', className, '">');
  pushEscaped(out, source, start, end);
  out.push('</span>');
}

function escapeHtml(source: string): string {
  const out: string[] = [];
  pushEscaped(out, source, 0, source.length);
  return out.join('');
}

function findStringEnd(
  source: string,
  start: number,
  quoteCode: number,
  allowNewlines: boolean = false
): number {
  let i = start + 1;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (!allowNewlines && (code === 10 || code === 13)) return -1;
    if (code === 92) {
      i += 2;
      continue;
    }
    if (code === quoteCode) return i + 1;
    i += 1;
  }
  return allowNewlines ? source.length : -1;
}

function findBlockCommentEnd(source: string, start: number): number {
  let i = start + 2;
  while (i < source.length - 1) {
    if (source.charCodeAt(i) === 42 && source.charCodeAt(i + 1) === 47) {
      return i + 2;
    }
    i += 1;
  }
  return source.length;
}

function findLineCommentEnd(source: string, start: number): number {
  const end = source.indexOf('\n', start + 2);
  return end === -1 ? source.length : end;
}

function nextNonSpaceCode(source: string, start: number): number {
  for (let i = start; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    if (!isWhitespaceCode(code)) return code;
  }
  return 0;
}

function isPunctuationCode(code: number): boolean {
  return (
    code === 123 ||
    code === 125 ||
    code === 91 ||
    code === 93 ||
    code === 40 ||
    code === 41 ||
    code === 59 ||
    code === 44 ||
    code === 46
  );
}

function isOperatorCode(code: number): boolean {
  return (
    code === 61 ||
    code === 43 ||
    code === 45 ||
    code === 42 ||
    code === 47 ||
    code === 37 ||
    code === 33 ||
    code === 60 ||
    code === 62 ||
    code === 38 ||
    code === 124 ||
    code === 94 ||
    code === 126 ||
    code === 63 ||
    code === 58
  );
}

function highlightTsxUncached(source: string): string {
  const out: string[] = [];
  const length = source.length;
  let i = 0;
  let previousTokenCode = 0;
  let previousLexicalToken = '';

  const TYPE_CONTEXTS = new Set([
    ':',
    'type',
    'interface',
    'class',
    'extends',
    'implements',
    'new',
    'as',
    '<',
    '|',
    '&',
    '=',
    'Omit',
    'Pick',
    'Partial',
    'Required',
    'Readonly',
    'Record',
    'Exclude',
    'Extract',
    'NonNullable',
    'ReturnType',
    'InstanceType',
    'Parameters',
  ]);

  let braceDepth = 0;
  const templateBraceDepths: number[] = [];
  let inTemplateString = false;

  while (i < length) {
    const code = source.charCodeAt(i);
    const nextCode = i + 1 < length ? source.charCodeAt(i + 1) : 0;

    if (code === 47 && nextCode === 47) {
      const stop = findLineCommentEnd(source, i);
      pushWrappedToken(out, 'rt-code-comment', source, i, stop);
      i = stop;
      continue;
    }

    if (code === 47 && nextCode === 42) {
      const stop = findBlockCommentEnd(source, i);
      pushWrappedToken(out, 'rt-code-comment', source, i, stop);
      i = stop;
      continue;
    }

    if (inTemplateString) {
      let stop = i;
      while (stop < length) {
        const charCode = source.charCodeAt(stop);
        const nextCharCode =
          stop + 1 < length ? source.charCodeAt(stop + 1) : 0;

        if (charCode === 92) {
          // backslash escape
          stop += 2;
          continue;
        }

        if (charCode === 36 && nextCharCode === 123) {
          // ${
          stop += 2;
          pushWrappedToken(out, 'rt-code-string', source, i, stop - 2);
          pushWrappedToken(out, 'rt-code-punctuation', source, stop - 2, stop);

          templateBraceDepths.push(braceDepth);
          braceDepth += 1;
          inTemplateString = false;
          i = stop;
          break;
        }

        if (charCode === 96) {
          // closing `
          stop += 1;
          pushWrappedToken(out, 'rt-code-string', source, i, stop);
          inTemplateString = false;
          previousTokenCode = 0;
          previousLexicalToken = 'STRING';
          i = stop;
          break;
        }

        stop += 1;
      }
      if (stop >= length && inTemplateString) {
        pushWrappedToken(out, 'rt-code-string', source, i, stop);
        i = stop;
      }
      if (i > stop || !inTemplateString) continue;
    }

    if (code === 39 || code === 34) {
      const stop = findStringEnd(source, i, code, false);
      if (stop === -1) {
        pushWrappedToken(out, 'rt-code-punctuation', source, i, i + 1);
        previousLexicalToken = String.fromCharCode(code);
        previousTokenCode = code;
        i += 1;
        continue;
      }
      pushWrappedToken(out, 'rt-code-string', source, i, stop);
      i = stop;
      previousTokenCode = 0;
      previousLexicalToken = 'STRING';
      continue;
    }

    if (code === 96) {
      inTemplateString = true;
      pushWrappedToken(out, 'rt-code-string', source, i, i + 1);
      i += 1;
      continue;
    }

    if (code >= 48 && code <= 57) {
      const previousCode = i === 0 ? 0 : source.charCodeAt(i - 1);
      if (!isIdentifierPartCode(previousCode)) {
        let stop = i + 1;
        while (stop < length) {
          const numberCode = source.charCodeAt(stop);
          const isDigit = numberCode >= 48 && numberCode <= 57;
          const isSeparator = numberCode === 95 || numberCode === 46;
          const isHex =
            (numberCode >= 65 && numberCode <= 70) ||
            (numberCode >= 97 && numberCode <= 102) ||
            numberCode === 120 ||
            numberCode === 88;
          const isSuffix =
            numberCode === 110 ||
            numberCode === 101 ||
            numberCode === 69 ||
            numberCode === 43 ||
            numberCode === 45;

          if (!isDigit && !isSeparator && !isHex && !isSuffix) break;
          stop += 1;
        }

        pushWrappedToken(out, 'rt-code-number', source, i, stop);
        i = stop;
        previousTokenCode = 0;
        previousLexicalToken = 'NUMBER';
        continue;
      }
    }

    if (code === 60 && (isIdentifierStartCode(nextCode) || nextCode === 47)) {
      out.push('&lt;');
      i += 1;

      if (i < length && source.charCodeAt(i) === 47) {
        out.push('/');
        i += 1;
      }

      let stop = i;
      let isComponent = false;
      if (stop < length && isUppercaseLetterCode(source.charCodeAt(stop))) {
        isComponent = true;
      }

      while (stop < length && isIdentifierPartCode(source.charCodeAt(stop))) {
        stop += 1;
      }

      if (stop > i) {
        const className = isComponent ? 'rt-code-component' : 'rt-code-tag';
        pushWrappedToken(out, className, source, i, stop);
        i = stop;
        previousLexicalToken = 'TAG';
      }

      previousTokenCode = 0;
      continue;
    }

    if (isIdentifierStartCode(code)) {
      let stop = i + 1;
      while (stop < length && isIdentifierPartCode(source.charCodeAt(stop))) {
        stop += 1;
      }

      const token = source.slice(i, stop);
      const isProperty = previousTokenCode === 46;
      let isType = isUppercaseLetterCode(code);
      const isFunction = nextNonSpaceCode(source, stop) === 40;

      if (isType) {
        if (!TYPE_CONTEXTS.has(previousLexicalToken)) {
          isType = false;
        }
      }

      if (KEYWORDS.has(token)) {
        pushWrappedToken(out, 'rt-code-keyword', source, i, stop);
      } else if (BOOLEANS.has(token)) {
        pushWrappedToken(out, 'rt-code-boolean', source, i, stop);
      } else if (BUILTINS.has(token)) {
        pushWrappedToken(out, 'rt-code-builtin', source, i, stop);
      } else if (isFunction) {
        pushWrappedToken(out, 'rt-code-function', source, i, stop);
      } else if (isProperty) {
        pushWrappedToken(out, 'rt-code-property', source, i, stop);
      } else if (isType) {
        pushWrappedToken(out, 'rt-code-type', source, i, stop);
      } else {
        out.push(token);
      }

      previousTokenCode = source.charCodeAt(stop - 1);
      previousLexicalToken = token;
      i = stop;
      continue;
    }

    if (isPunctuationCode(code)) {
      if (code === 123) braceDepth += 1; // {
      if (code === 125) braceDepth -= 1; // }

      const char = source[i];
      pushWrappedToken(out, 'rt-code-punctuation', source, i, i + 1);
      previousLexicalToken = char;
      i += 1;

      if (code === 125 && templateBraceDepths.length > 0) {
        if (
          braceDepth === templateBraceDepths[templateBraceDepths.length - 1]
        ) {
          templateBraceDepths.pop();
          inTemplateString = true;
        }
      }
      continue;
    } else if (isOperatorCode(code)) {
      const char = source[i];
      pushWrappedToken(out, 'rt-code-operator', source, i, i + 1);
      previousLexicalToken = char;
    } else {
      if (code === 38) out.push('&amp;');
      else if (code === 60) out.push('&lt;');
      else if (code === 62) out.push('&gt;');
      else out.push(source[i]);
      if (!isWhitespaceCode(code)) previousLexicalToken = source[i];
    }

    if (!isWhitespaceCode(code)) previousTokenCode = code;
    i += 1;
  }

  return out.join('');
}

const SHELL_COMMANDS = new Set([
  'echo',
  'cd',
  'ls',
  'pwd',
  'mkdir',
  'rm',
  'mv',
  'cp',
  'cat',
  'grep',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'npx',
  'node',
  'export',
  'set',
  'env',
  'source',
  'bash',
  'sh',
  'zsh',
  'sudo',
  'apt',
  'brew',
  'git',
  'docker',
  'kubectl',
]);

function highlightShellUncached(source: string): string {
  const out: string[] = [];
  const length = source.length;
  let i = 0;

  while (i < length) {
    const code = source.charCodeAt(i);

    if (code === 35) {
      let stop = i + 1;
      while (stop < length && source.charCodeAt(stop) !== 10) stop += 1;
      pushWrappedToken(out, 'rt-code-comment', source, i, stop);
      i = stop;
      continue;
    }

    if (code === 34 || code === 39) {
      const stop = findStringEnd(source, i, code, true);
      pushWrappedToken(out, 'rt-code-string', source, i, stop);
      i = stop;
      continue;
    }

    if (code === 36) {
      let stop = i + 1;
      if (stop < length && source.charCodeAt(stop) === 123) {
        while (stop < length && source.charCodeAt(stop) !== 125) stop += 1;
        if (stop < length) stop += 1;
      } else {
        while (stop < length) {
          const nextCode = source.charCodeAt(stop);
          if (isIdentifierPartCode(nextCode)) stop += 1;
          else break;
        }
      }
      pushWrappedToken(out, 'rt-code-property', source, i, stop);
      i = stop;
      continue;
    }

    if (code === 45) {
      const previousCode = i > 0 ? source.charCodeAt(i - 1) : 32;
      if (isWhitespaceCode(previousCode)) {
        let stop = i + 1;
        while (stop < length) {
          const nextCode = source.charCodeAt(stop);
          if (!isWhitespaceCode(nextCode) && nextCode !== 61) stop += 1;
          else break;
        }
        pushWrappedToken(out, 'rt-code-keyword', source, i, stop);
        i = stop;
        continue;
      }
    }

    if (isIdentifierStartCode(code)) {
      let stop = i + 1;
      while (stop < length && isIdentifierPartCode(source.charCodeAt(stop)))
        stop += 1;
      const token = source.substring(i, stop);

      let isCommand = false;
      let j = i - 1;
      while (j >= 0 && isWhitespaceCode(source.charCodeAt(j))) {
        if (source.charCodeAt(j) === 10) {
          isCommand = true;
          break;
        }
        j--;
      }
      if (i === 0) isCommand = true;

      if (SHELL_COMMANDS.has(token) || isCommand) {
        pushWrappedToken(out, 'rt-code-function', source, i, stop);
      } else {
        out.push(token);
      }

      i = stop;
      continue;
    }

    if (code === 38) out.push('&amp;');
    else if (code === 60) out.push('&lt;');
    else if (code === 62) out.push('&gt;');
    else out.push(source[i]);

    i += 1;
  }
  return out.join('');
}

export function highlightShell(source: string): string {
  const cached = SHELL_CACHE.get(source);
  if (cached !== undefined) return cached;

  const highlighted = highlightShellUncached(source);

  if (SHELL_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = SHELL_CACHE.keys().next().value;
    if (firstKey !== undefined) SHELL_CACHE.delete(firstKey);
  }

  SHELL_CACHE.set(source, highlighted);
  return highlighted;
}

export function highlightTsx(source: string): string {
  const cached = TSX_CACHE.get(source);
  if (cached !== undefined) return cached;

  const highlighted = highlightTsxUncached(source);

  if (TSX_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = TSX_CACHE.keys().next().value;
    if (firstKey !== undefined) TSX_CACHE.delete(firstKey);
  }

  TSX_CACHE.set(source, highlighted);
  return highlighted;
}

export function highlightCode(source: string, lang: string): string {
  const lowercaseLang = lang.toLowerCase();

  if (
    lowercaseLang === 'tsx' ||
    lowercaseLang === 'jsx' ||
    lowercaseLang === 'csx' ||
    lowercaseLang === 'ts' ||
    lowercaseLang === 'js'
  ) {
    return highlightTsx(source);
  }

  if (
    lowercaseLang === 'sh' ||
    lowercaseLang === 'shell' ||
    lowercaseLang === 'bash' ||
    lowercaseLang === 'zsh'
  ) {
    return highlightShell(source);
  }

  return escapeHtml(source);
}

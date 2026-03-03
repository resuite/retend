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
  'false',
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
  'true',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const MAX_CACHE_ENTRIES = 64;
const TSX_CACHE = new Map<string, string>();

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
  quoteCode: number
): number {
  let i = start + 1;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 92) {
      i += 2;
      continue;
    }
    if (code === quoteCode) return i + 1;
    i += 1;
  }
  return source.length;
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

function highlightTsxUncached(source: string): string {
  const out: string[] = [];
  const length = source.length;
  let i = 0;
  let previousTokenCode = 0;

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

    if (code === 39 || code === 34 || code === 96) {
      const stop = findStringEnd(source, i, code);
      pushWrappedToken(out, 'rt-code-string', source, i, stop);
      i = stop;
      previousTokenCode = 0;
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
      while (stop < length && isIdentifierPartCode(source.charCodeAt(stop))) {
        stop += 1;
      }

      if (stop > i) {
        pushWrappedToken(out, 'rt-code-tag', source, i, stop);
        i = stop;
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
      const isType = isUppercaseLetterCode(code);
      const isFunction = nextNonSpaceCode(source, stop) === 40;

      if (KEYWORDS.has(token)) {
        pushWrappedToken(out, 'rt-code-keyword', source, i, stop);
      } else if (isProperty) {
        pushWrappedToken(out, 'rt-code-property', source, i, stop);
      } else if (isFunction) {
        pushWrappedToken(out, 'rt-code-function', source, i, stop);
      } else if (isType) {
        pushWrappedToken(out, 'rt-code-type', source, i, stop);
      } else {
        out.push(token);
      }

      previousTokenCode = source.charCodeAt(stop - 1);
      i = stop;
      continue;
    }

    if (code === 38) out.push('&amp;');
    else if (code === 60) out.push('&lt;');
    else if (code === 62) out.push('&gt;');
    else out.push(source[i]);

    if (!isWhitespaceCode(code)) previousTokenCode = code;
    i += 1;
  }

  return out.join('');
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
  if (lang.toLowerCase() === 'tsx') return highlightTsx(source);
  return escapeHtml(source);
}

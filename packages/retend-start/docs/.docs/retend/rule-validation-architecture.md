# Modern Rule Validation Tool

## Philosophy

**Don't duplicate TypeScript's job.** TypeScript already catches:

- Passing dependency arrays to `Cell.derived()` (type error)
- Calling `.set()` on derived cells (type error)
- Using non-existent React hooks (type error)
- Type mismatches in props

**Focus on what TypeScript CAN'T catch:**

- Semantic/logical mistakes (works but wrong)
- Performance anti-patterns (works but slow)
- Stylistic inconsistencies (works but messy)
- React habit regressions (works but not idiomatic)

## Standard Rule Format (Docs)

All rule docs should follow a consistent structure so humans and tools can parse them reliably.

**Required Sections:**

1. Header table with: `title`, `impact`, `impactDescription`, `tags`
2. `# {Title}`
3. `**Context**` and `**Rule**`
4. `## Detection` (link or reference to `rules/_index.md`)
5. `## Examples` (Invalid + Valid)
6. `## Auto-Fix` (if applicable; otherwise note manual fix)
7. `## Related Rules`

**Canonical Detection Index:**

- Detection patterns live in `rules/_index.md` for centralized updates.

## Architecture: Standalone AST Analyzer

```typescript
#!/usr/bin/env bun
// bin/retend-check.ts

import * as ts from 'typescript';
import { glob } from 'glob';

// === VIOLATION TYPES ===
// Only patterns that TypeScript allows but are wrong semantically

type Severity = 'error' | 'warning' | 'style';

interface Violation {
  rule: string;
  message: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  fix?: string; // Suggested fix
}

// === RULES: Semantic/Logical Only ===

const rules: Rule[] = [
  // =====================================
  // CRITICAL: .get() in JSX
  // TypeScript allows it, but breaks reactivity
  // =====================================
  {
    id: 'no-get-in-jsx',
    severity: 'error',
    description: 'Calling .get() in JSX breaks fine-grained reactivity',
    check: (node, sourceFile) => {
      if (!ts.isJsxExpression(node)) return [];

      const violations: Violation[] = [];

      // Walk the expression looking for .get() calls
      function visit(n: ts.Node) {
        if (
          ts.isPropertyAccessExpression(n) &&
          n.name.text === 'get' &&
          ts.isCallExpression(n.parent)
        ) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            n.getStart()
          );
          violations.push({
            rule: 'no-get-in-jsx',
            message:
              'Calling .get() in JSX returns a static snapshot. Pass the Cell directly for reactivity.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'error',
            fix: 'Remove .get() - pass the Cell object directly',
          });
        }
        ts.forEachChild(n, visit);
      }

      visit(node.expression);
      return violations;
    },
  },

  // =====================================
  // CRITICAL: Ternary operators in JSX
  // TypeScript allows, but bypasses Retend's control flow
  // =====================================
  {
    id: 'no-ternary-in-jsx',
    severity: 'error',
    description: 'Ternary operators break reactive control flow',
    check: (node, sourceFile) => {
      if (!ts.isJsxExpression(node)) return [];

      const violations: Violation[] = [];

      function visit(n: ts.Node) {
        if (ts.isConditionalExpression(n)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            n.getStart()
          );
          violations.push({
            rule: 'no-ternary-in-jsx',
            message:
              "Ternary operators (? :) in JSX bypass Retend's reactive control flow. Use If() component.",
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'error',
            fix: `Replace: {condition ? <A /> : <B />} → {If(condition, { true: () => <A />, false: () => <B /> })}`,
          });
        }
        ts.forEachChild(n, visit);
      }

      visit(node.expression);
      return violations;
    },
  },

  // =====================================
  // CRITICAL: Logical operators in JSX
  // TypeScript allows, but not idiomatic
  // =====================================
  {
    id: 'no-logical-in-jsx',
    severity: 'error',
    description: 'Logical operators (&& ||) in JSX are not reactive',
    check: (node, sourceFile) => {
      if (!ts.isJsxExpression(node)) return [];

      const violations: Violation[] = [];

      function visit(n: ts.Node) {
        if (
          ts.isBinaryExpression(n) &&
          (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        ) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            n.getStart()
          );
          violations.push({
            rule: 'no-logical-in-jsx',
            message:
              'Logical operators (&&, ||) in JSX are not reactive. Use If() component.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'error',
            fix: `Replace: {condition && <A />} → {If(condition, { true: () => <A /> })}`,
          });
        }
        ts.forEachChild(n, visit);
      }

      visit(node.expression);
      return violations;
    },
  },

  // =====================================
  // CRITICAL: .map() instead of For()
  // TypeScript allows, but terrible performance
  // =====================================
  {
    id: 'no-map-in-jsx',
    severity: 'error',
    description: '.map() re-renders entire list, For() is granular',
    check: (node, sourceFile) => {
      if (!ts.isJsxExpression(node)) return [];

      const violations: Violation[] = [];

      function visit(n: ts.Node) {
        // Look for: something.map(...)
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'map'
        ) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            n.getStart()
          );
          violations.push({
            rule: 'no-map-in-jsx',
            message:
              '.map() in JSX re-renders the entire list on any change. Use For() for granular updates.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'error',
            fix: 'Replace: {items.get().map(i => <Item />)} → {For(items, i => <Item />)}',
          });
        }
        ts.forEachChild(n, visit);
      }

      visit(node.expression);
      return violations;
    },
  },

  // =====================================
  // WARNING: Inline event handlers
  // TypeScript allows both, but hoisted is cleaner
  // =====================================
  {
    id: 'prefer-hoisted-handlers',
    severity: 'warning',
    description: 'Hoist event handlers for cleaner JSX',
    check: (node, sourceFile) => {
      if (!ts.isJsxAttribute(node)) return [];
      if (!node.initializer) return [];

      // Check if it's an event handler (starts with 'on')
      const attrName = node.name.text;
      if (!attrName.startsWith('on')) return [];

      // Check if value is inline arrow function
      let expression: ts.Node | undefined;
      if (ts.isJsxExpression(node.initializer)) {
        expression = node.initializer.expression;
      }

      if (!expression) return [];

      // Inline arrow function or complex expression
      if (
        ts.isArrowFunction(expression) ||
        (ts.isCallExpression(expression) &&
          !ts.isIdentifier(expression.expression))
      ) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        return [
          {
            rule: 'prefer-hoisted-handlers',
            message:
              'Event handlers should be hoisted as named functions, not inline in JSX.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'warning',
            fix: 'Define: const handleClick = () => { ... } then use: onClick={handleClick}',
          },
        ];
      }

      return [];
    },
  },

  // =====================================
  // WARNING: Missing keys in For with objects
  // TypeScript doesn't enforce this
  // =====================================
  {
    id: 'require-for-keys',
    severity: 'warning',
    description: 'For with object arrays needs explicit keys',
    check: (node, sourceFile) => {
      if (!ts.isCallExpression(node)) return [];

      // Check if it's a For() call
      const funcName = node.expression.getText();
      if (funcName !== 'For' && !funcName.endsWith('.For')) return [];

      // Check if it has 3+ arguments (the third would be options with key)
      if (node.arguments.length >= 3) return [];

      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      return [
        {
          rule: 'require-for-keys',
          message:
            'For() with object arrays should have explicit keys for efficient updates.',
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          severity: 'warning',
          fix: 'Add: { key: "id" } as third argument to For()',
        },
      ];
    },
  },

  // =====================================
  // WARNING: Window location navigation
  // TypeScript allows, but breaks SPA behavior
  // =====================================
  {
    id: 'no-window-location',
    severity: 'error',
    description: 'window.location causes full page reload',
    check: (node, sourceFile) => {
      if (!ts.isPropertyAccessExpression(node)) return [];

      const text = node.getText();
      if (!text.includes('window.location') && !text.includes('window.history'))
        return [];

      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      return [
        {
          rule: 'no-window-location',
          message:
            'Using window.location or window.history causes full page reloads. Use router.navigate() for SPA navigation.',
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          severity: 'error',
          fix: 'Replace: window.location.href = "/path" → router.navigate("/path")',
        },
      ];
    },
  },

  // =====================================
  // STYLE: Using htmlFor instead of for
  // TypeScript allows both, but for is idiomatic
  // =====================================
  {
    id: 'use-for-attribute',
    severity: 'style',
    description: 'Retend uses standard HTML "for", not React\'s "htmlFor"',
    check: (node, sourceFile) => {
      if (!ts.isJsxAttribute(node)) return [];
      if (node.name.text !== 'htmlFor') return [];

      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      return [
        {
          rule: 'use-for-attribute',
          message:
            'Use standard HTML "for" attribute instead of React\'s "htmlFor".',
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          severity: 'style',
          fix: 'Replace: htmlFor="id" → for="id"',
        },
      ];
    },
  },

  // =====================================
  // STYLE: String concatenation for classes
  // TypeScript allows, but Array syntax is better
  // =====================================
  {
    id: 'prefer-class-array',
    severity: 'style',
    description: 'Use Array syntax for dynamic classes',
    check: (node, sourceFile) => {
      if (!ts.isJsxAttribute(node)) return [];
      if (node.name.text !== 'class' && node.name.text !== 'className')
        return [];
      if (!node.initializer) return [];

      let expression: ts.Node | undefined;
      if (ts.isJsxExpression(node.initializer)) {
        expression = node.initializer.expression;
      } else if (ts.isStringLiteral(node.initializer)) {
        return [];
      }

      if (!expression) return [];

      // Check for string concatenation
      if (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        return [
          {
            rule: 'prefer-class-array',
            message:
              'Use Array syntax for dynamic classes instead of string concatenation.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'style',
            fix: 'Replace: class={"btn " + variant} → class={[\'btn\', variant]}',
          },
        ];
      }

      // Check for template literals with expressions
      if (ts.isTemplateExpression(expression)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        return [
          {
            rule: 'prefer-class-array',
            message:
              'Use Array syntax for dynamic classes instead of template literals.',
            file: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            severity: 'style',
            fix: "Replace: class={`btn ${variant}`} → class={['btn', variant]}",
          },
        ];
      }

      return [];
    },
  },

  // =====================================
  // WARNING: Not awaiting query mutations
  // TypeScript might not catch async issues
  // =====================================
  {
    id: 'await-query-mutations',
    severity: 'warning',
    description: 'Query mutations return Promises and should be awaited',
    check: (node, sourceFile, checker) => {
      if (!ts.isCallExpression(node)) return [];

      // Check if it's a query mutation: query.set(), query.delete(), etc.
      if (!ts.isPropertyAccessExpression(node.expression)) return [];

      const methodName = node.expression.name.text;
      if (!['set', 'delete', 'clear', 'append'].includes(methodName)) return [];

      // Check if parent is async function
      let parent = node.parent;
      let isInAsyncContext = false;
      while (parent) {
        if (
          ts.isFunctionDeclaration(parent) ||
          ts.isArrowFunction(parent) ||
          ts.isMethodDeclaration(parent)
        ) {
          isInAsyncContext =
            parent.modifiers?.some(
              (m) => m.kind === ts.SyntaxKind.AsyncKeyword
            ) ?? false;
          break;
        }
        parent = parent.parent;
      }

      if (!isInAsyncContext) return [];

      // Check if the call is awaited
      if (ts.isAwaitExpression(node.parent)) return [];

      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      return [
        {
          rule: 'await-query-mutations',
          message:
            'Route query mutations are async and should be awaited to ensure navigation completes.',
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          severity: 'warning',
          fix: 'Add await: await query.set("key", value)',
        },
      ];
    },
  },

  // =====================================
  // WARNING: Passing static item in keyed For
  // Works but breaks reactivity for item updates
  // =====================================
  {
    id: 'for-reactive-items',
    severity: 'warning',
    description:
      'Pass Cell<Item> to children in keyed For, not static snapshot',
    check: (node, sourceFile, checker) => {
      // Complex check - look for keyed For passing item directly to components
      // This requires analyzing the For callback and its props
      // Implementation would track if For has key option and if child receives item
      return []; // Placeholder for complex implementation
    },
  },
];

// === MAIN ===

async function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : await glob('src/**/*.{ts,tsx}');

  const allViolations: Violation[] = [];

  for (const file of files) {
    const sourceText = await fs.readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    // Visit all nodes
    function visit(node: ts.Node) {
      for (const rule of rules) {
        const violations = rule.check(node, sourceFile);
        allViolations.push(...violations);
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  // Report
  if (allViolations.length === 0) {
    console.log('✅ All Retend semantic rules passed!');
    process.exit(0);
  }

  // Group by severity
  const errors = allViolations.filter((v) => v.severity === 'error');
  const warnings = allViolations.filter((v) => v.severity === 'warning');
  const styles = allViolations.filter((v) => v.severity === 'style');

  console.log(`\n❌ Found ${allViolations.length} issues:\n`);

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    for (const v of errors) {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`  [${v.rule}] ${v.message}`);
      if (v.fix) console.log(`  Fix: ${v.fix}`);
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    for (const v of warnings) {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`  [${v.rule}] ${v.message}`);
      console.log();
    }
  }

  if (styles.length > 0) {
    console.log(`STYLE ISSUES (${styles.length}):`);
    for (const v of styles) {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`  [${v.rule}] ${v.message}`);
      console.log();
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(console.error);
```

## Key Design Decisions

1. **Standalone Tool**: No ESLint/Biome dependency. Just TypeScript's parser.
2. **Semantic Only**: Only checks what TypeScript allows but is logically wrong
3. **Modern Runtime**: Uses Bun (or Node 20+) for speed
4. **Simple CLI**: `retend-check src/` or `retend-check file.tsx`
5. **Clear Output**: Shows file:line:column with fix suggestions
6. **Exit Codes**: Non-zero exit if errors exist (for CI/CD)

## What It Catches (That Types Don't)

| Issue                 | TypeScript | retend-check  |
| --------------------- | ---------- | ------------- |
| `.get()` in JSX       | ✅ Allows  | ❌ Catches    |
| Ternary in JSX        | ✅ Allows  | ❌ Catches    |
| `.map()` in JSX       | ✅ Allows  | ❌ Catches    |
| Inline handlers       | ✅ Allows  | ⚠️ Warns      |
| Missing For keys      | ✅ Allows  | ⚠️ Warns      |
| `window.location`     | ✅ Allows  | ❌ Catches    |
| `htmlFor` attribute   | ✅ Allows  | ⚠️ Styles     |
| String class concat   | ✅ Allows  | ⚠️ Styles     |
| Not awaiting queries  | ✅ Allows  | ⚠️ Warns      |
| Dep arrays in derived | ❌ Errors  | (not checked) |
| Setting derived cells | ❌ Errors  | (not checked) |

## Usage

```bash
# Install globally or locally
npm install -D retend-check

# Check all files
npx retend-check src/

# Check specific files
npx retend-check src/components/Counter.tsx

# In package.json scripts
{
  "scripts": {
    "check": "retend-check src/",
    "check:ci": "retend-check src/ --fail-on-warning"
  }
}

# CI/CD
- run: npm run check
```

## Next Steps

1. Implement this as a real package
2. Add more sophisticated rules (detect React imports, check for keyed For patterns)
3. Add `--fix` flag for auto-fixable issues
4. Add configuration file support (retend-check.config.js)
5. Add IDE integration via LSP or extension

The key insight: **Trust TypeScript for type safety. Use retend-check for semantic correctness.**

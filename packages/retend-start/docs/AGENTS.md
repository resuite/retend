---
description: Main skill for retend-start monorepo. Provides unified access to all retend and retend-web skills.
---

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any Retend frontend tasks.

**CONSOLIDATED GUIDES (Use These First - Optimized for LLMs):**

These consolidated files organize all rules by topic for easier consumption by LLMs. Each rule is explicitly stated with clear DO/DO NOT examples.

1. **`.docs/consolidated/react-migration-patterns.md`** - **[START HERE]** Critical patterns for React developers. Prevents the most common mistakes when reverting to React patterns.
2. **`.docs/consolidated/jsx-reactivity-patterns.md`** - Core reactivity rules. How to use Cells in JSX correctly.
3. **`.docs/consolidated/derived-cells-complete-guide.md`** - Complete guide to Cell.derived() and Cell.derivedAsync().
4. **`.docs/consolidated/control-flow-patterns.md`** - If, For, Switch, and Observer patterns.
5. **`.docs/consolidated/component-structure-patterns.md`** - Component organization, naming, and structure.
6. **`.docs/consolidated/routing-patterns.md`** - Router setup, navigation, and route configuration.
7. **`.docs/consolidated/common-anti-patterns.md`** - What NOT to do and why. Essential for avoiding mistakes.
8. **`.docs/consolidated/rule-validation-architecture.md`** - Design for automated rule checking.

**CLI VALIDATION TOOL:**
Run `npx retend-check [files...]` to validate code against Retend patterns.

**Rules Checked:**
- **Errors**: `.get()` in JSX, React hooks, dependency arrays, ternary/logical in JSX, `.map()` in JSX, `window.location`, internal `<a>` tags
- **Warnings**: Inline handlers, missing button types
- **Style**: `htmlFor` (should be `for`), `className` (should be `class`), string class concatenation

**Usage:**
```bash
# Check all files in src/
npx retend-check

# Check specific files
npx retend-check src/components/Counter.tsx

# Check with glob
npx retend-check "src/**/*.tsx"
```

**Exit codes:** 0 = all passed, 1 = errors found

---

**Severity Levels:**
- **[CRITICAL]** - Will cause bugs or errors. Must follow.
- **[WARNING]** - Suboptimal or error-prone. Should follow.
- **[STYLE]** - Consistency and readability. Recommended.

**Quick Decision Flows:**
Each consolidated file includes decision trees for common scenarios. Look for "Quick Decision Flow" or "Decision Tree" sections.

---

**DETAILED REFERENCES (API Documentation):**

Use these for detailed API information and edge cases.

- `.docs/retend/references/cells-api.md` - Complete Cell API reference with all methods and patterns
- `.docs/retend/references/control-flow.md` - Detailed guide to If/For/Switch/Observer with examples
- `.docs/retend/references/routing/setup.md` - Router initialization, lazy loading, subtrees, and 404s
- `.docs/retend/references/routing/navigation.md` - Navigation hooks, Link component, and Active state
- `.docs/retend/references/routing/data.md` - Dynamic route params and query parameters
- `.docs/retend/references/routing/middleware.md` - Router middleware and redirects
- `.docs/retend/references/routing/advanced.md` - Nested routes, Locking, Stack Mode, View Transitions
- `.docs/retend/references/retend-utils.md` - Complete reference for all hooks and components in retend-utils
- `.docs/retend/references/scopes.md` - Guide to Context API (Scopes), Providers, and useScopeContext
- `.docs/retend/references/element-references.md` - Using refs with Cells for direct DOM manipulation
- `.docs/retend/references/advanced-components.md` - Guide to createUnique (persistent identity)

**Individual Rules:**

These individual rule files are now organized in the consolidated guides above. Refer to those first.

**Core Rules:**
- `.docs/retend/rules/key-for-items.md` - Always provide explicit keys for For component with objects.
- `.docs/retend/rules/prefer-subtrees.md` - Use `subtree` for large route trees.
- `.docs/retend/rules/headless-routes.md` - Use headless routes for grouping.
- `.docs/retend/rules/avoid-route-names.md` - Avoid using `name` field.
- `.docs/retend/rules/keep-cells-granular.md` - Keep state granular.
- `.docs/retend/rules/pure-derived-cells.md` - Derived cells must be pure.
- `.docs/retend/rules/use-peek.md` - Use `.peek()` for non-reactive reads.
- `.docs/retend/rules/component-scoped-listeners.md` - Listeners inside components.
- `.docs/retend/rules/no-listen-in-onSetup.md` - **CRITICAL**: Never wrap .listen() in onSetup.
- `.docs/retend/rules/use-builtin-control-flow.md` - Use `If`/`For` helpers.
- `.docs/retend/rules/pure-render-callbacks.md` - Render callbacks must be pure.
- `.docs/retend/rules/top-level-hooks.md` - Only call hooks at top level.
- `.docs/retend/rules/prefer-input-component.md` - Use `Input` helper.
- `.docs/retend/rules/refs-on-elements.md` - Safe ref creation and typing.
- `.docs/retend/rules/pass-cells-directly.md` - Don't unwrap cells in JSX.
- `.docs/retend/rules/derived-outside-jsx.md` - Define derived state outside JSX.
- `.docs/retend/rules/destructure-props-in-body.md` - Destructure props in body.
- `.docs/retend/rules/customizable-components.md` - Favor extension over invention.
- `.docs/retend/rules/explicit-children-type.md` - Use `JSX.Children`.
- `.docs/retend/rules/scope-injection.md` - Use function children for scopes.
- `.docs/retend/rules/no-any.md` - No `any` type.
- `.docs/retend/rules/reactive-props.md` - Handle ValueOrCell props.
- `.docs/retend/rules/prefer-scopes.md` - Avoid prop drilling.
- `.docs/retend/rules/self-closing-tags.md` - Used self-closing tags.
- `.docs/retend/rules/button-type.md` - Always set button type.
- `.docs/retend/rules/use-for-attribute.md` - Use `for` not `htmlFor`.
- `.docs/retend/rules/prefer-event-modifiers.md` - Use modifiers.
- `.docs/retend/rules/unique-component-ids.md` - Unique IDs for `createUnique`.
- `.docs/retend/rules/component-structure.md` - Order of internals.
- `.docs/retend/rules/svg-xmlns.md` - Required xmlns for SVG.
- `.docs/retend/rules/use-link-component.md` - Use `Link` for internal navigation.
- `.docs/retend/rules/no-logical-operators-in-jsx.md` - No ternary or logical operators (&&, ||) in JSX.
- `.docs/retend/rules/function-children-as-component.md` - Render function children as components.
- `.docs/retend/rules/combine-scopes-keys.md` - Use `[Scope.key]` for combined scopes.
- `.docs/retend/rules/component-pascal-case.md` - Use PascalCase for components.
- `.docs/retend/rules/hoist-handlers.md` - Hoist event handlers.
- `.docs/retend/rules/prefer-router-navigation.md` - Use router for navigation.
- `.docs/retend/rules/no-react-hooks.md` - Do not use React hooks (useState, useEffect, etc.).
- `.docs/retend/rules/no-get-in-jsx.md` - Never call .get() on Cells inside JSX.
- `.docs/retend/rules/no-dependency-arrays.md` - Don't use dependency arrays with Cell.derived or onSetup.
- `.docs/retend/rules/derived-cells-readonly.md` - Never call .set() on derived cells.
- `.docs/retend/rules/derivedAsync-use-get-param.md` - Use the `get` parameter to track dependencies in derivedAsync.
- `.docs/retend/rules/derivedAsync-handle-errors.md` - Always handle errors from derivedAsync cells.
- `.docs/retend/rules/derivedAsync-use-abort-signal.md` - Pass AbortSignal to fetch/cancellable operations.
- `.docs/retend/rules/derivedAsync-handle-pending.md` - Show loading state while derivedAsync is pending.
- `.docs/retend/rules/derivedAsync-readonly.md` - Never call .set() on derivedAsync cells.
- `.docs/retend/rules/derivedAsync-pure-function.md` - Keep derivedAsync callbacks pure (no side effects).
- `.docs/retend/rules/derivedAsync-outside-jsx.md` - Define derivedAsync in component body, not inline.
- `.docs/retend/rules/derivedAsync-from-derivedAsync.md` - Derive async cells from async cells using derivedAsync.
- `.docs/retend/rules/task-use-abort-signal.md` - Pass AbortSignal to fetch/cancellable operations in Cell.task().
- `.docs/retend/rules/task-not-for-auto-refresh.md` - Don't use Cell.task() for auto-refreshing data.
- `.docs/retend/rules/task-define-at-component-level.md` - Define Cell.task() at component level, not in handlers.
- `.docs/retend/rules/task-handle-pending-and-error.md` - Handle pending and error states from Cell.task().
- `.docs/retend/rules/composite-for-related-data.md` - Use Cell.composite() only for related data.
- `.docs/retend/rules/no-usememo-usecallback.md` - Don't use useMemo/useCallback patterns.
- `.docs/retend/rules/scope-provider-function-children.md` - Always pass function children to Scope providers.
- `.docs/retend/rules/for-index-is-cell.md` - For's index parameter is a Cell, not a number.
- `.docs/retend/rules/teleport-selector-limitations.md` - Teleport only supports #id or tagname selectors.
- `.docs/retend/rules/lowercase-event-names.md` - Use camelCase event names (onClick not onclick).
- `.docs/retend/rules/no-re-render-optimization.md` - Don't optimize for "re-renders" - components don't re-render.
- `.docs/retend/rules/query-mutations-are-async.md` - Route query mutations are async and trigger navigation.
- `.docs/retend/rules/useobserver-not-layouteffect.md` - Use useObserver for DOM connection awareness.
- `.docs/retend/rules/no-react-imports.md` - Don't import from 'react' or 'react-dom'.
- `.docs/retend/rules/consistent-values-await.md` - Always await useConsistent() calls.
- `.docs/retend/rules/prefer-switch-for-multiple-cases.md` - Use Switch() for multiple conditional branches.
- `.docs/retend/rules/prefer-if-object-syntax.md` - Use object syntax for If when both branches exist.
- `.docs/retend/rules/for-pass-cell-to-children.md` - Pass Cell<Item> to children in keyed For loops.
- `.docs/retend/rules/fragment-shorthand.md` - Use <>...</> shorthand for fragments.
- `.docs/retend/rules/no-manual-keys-on-for-children.md` - Don't add manual key props to For children.

### retend-web
- **Path**: `.docs/retend-web/`
- **Description**: Web-specific features for Retend. Use when building web applications with Retend.

**References:**
- `.docs/retend-web/references/setup.md` - Renderer initialization and configuration.
- `.docs/retend-web/references/attributes-and-events.md` - Guide to classes, styles, and event handling.
- `.docs/retend-web/references/event-modifiers.md` - Detailed reference for all event modifiers.
- `.docs/retend-web/references/components.md` - Teleport, ShadowRoot, and other web-specific components.
- `.docs/retend-web/references/hydration.md` - Enabling and managing hydration.

**Rules:**
- `.docs/retend-web/rules/class-attribute-syntax.md` - No string concat or ternaries for classes.
- `.docs/retend-web/rules/component-class-merging.md` - Merge classes with props correctly.

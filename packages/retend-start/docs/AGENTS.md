---
description: Main skill for retend-start monorepo. Provides unified access to all retend and retend-web skills.
---

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning
for any Retend frontend tasks.

**References**:
- `.agent/skills/retend/references/cells-api.md` - Complete Cell API reference with all methods and patterns
- `.agent/skills/retend/references/control-flow.md` - Detailed guide to If/For/Switch/Observer with examples
- `.agent/skills/retend/references/routing/setup.md` - Router initialization, lazy loading, subtrees, and 404s
- `.agent/skills/retend/references/routing/navigation.md` - Navigation hooks, Link component, and Active state
- `.agent/skills/retend/references/routing/data.md` - Dynamic route params and query parameters
- `.agent/skills/retend/references/routing/middleware.md` - Router middleware and redirects
- `.agent/skills/retend/references/routing/advanced.md` - Nested routes, Locking, Stack Mode, View Transitions
- `.agent/skills/retend/references/retend-utils.md` - Complete reference for all hooks and components in retend-utils
- `.agent/skills/retend/references/scopes.md` - Guide to Context API (Scopes), Providers, and useScopeContext
- `.agent/skills/retend/references/element-references.md` - Using refs with Cells for direct DOM manipulation
- `.agent/skills/retend/references/advanced-components.md` - Guide to createUnique (persistent identity)

**Rules**:
- `.agent/skills/retend/rules/key-for-items.md` - Always provide explicit keys for For component with objects.
- `.agent/skills/retend/rules/prefer-subtrees.md` - Use `subtree` for large route trees.
- `.agent/skills/retend/rules/headless-routes.md` - Use headless routes for grouping.
- `.agent/skills/retend/rules/avoid-route-names.md` - Avoid using `name` field.
- `.agent/skills/retend/rules/keep-cells-granular.md` - Keep state granular.
- `.agent/skills/retend/rules/pure-derived-cells.md` - Derived cells must be pure.
- `.agent/skills/retend/rules/use-peek.md` - Use `.peek()` for non-reactive reads.
- `.agent/skills/retend/rules/component-scoped-listeners.md` - Listeners inside components.
- `.agent/skills/retend/rules/use-builtin-control-flow.md` - Use `If`/`For` helpers.
- `.agent/skills/retend/rules/pure-render-callbacks.md` - Render callbacks must be pure.
- `.agent/skills/retend/rules/top-level-hooks.md` - Only call hooks at top level.
- `.agent/skills/retend/rules/prefer-input-component.md` - Use `Input` helper.
- `.agent/skills/retend/rules/refs-on-elements.md` - Safe ref creation and typing.
- `.agent/skills/retend/rules/pass-cells-directly.md` - Don't unwrap cells in JSX.
- `.agent/skills/retend/rules/derived-outside-jsx.md` - Define derived state outside JSX.
- `.agent/skills/retend/rules/destructure-props-in-body.md` - Destructure props in body.
- `.agent/skills/retend/rules/customizable-components.md` - Favor extension over invention.
- `.agent/skills/retend/rules/explicit-children-type.md` - Use `JSX.Children`.
- `.agent/skills/retend/rules/scope-injection.md` - Use function children for scopes.
- `.agent/skills/retend/rules/no-any.md` - No `any` type.
- `.agent/skills/retend/rules/reactive-props.md` - Handle ValueOrCell props.
- `.agent/skills/retend/rules/prefer-scopes.md` - Avoid prop drilling.
- `.agent/skills/retend/rules/self-closing-tags.md` - Used self-closing tags.
- `.agent/skills/retend/rules/button-type.md` - Always set button type.
- `.agent/skills/retend/rules/use-for-attribute.md` - Use `for` not `htmlFor`.
- `.agent/skills/retend/rules/prefer-event-modifiers.md` - Use modifiers.
- `.agent/skills/retend/rules/unique-component-ids.md` - Unique IDs for `createUnique`.
- `.agent/skills/retend/rules/component-structure.md` - Order of internals.
- `.agent/skills/retend/rules/svg-xmlns.md` - Required xmlns for SVG.
- `.agent/skills/retend/rules/use-link-component.md` - Use `Link` for internal navigation.
- `.agent/skills/retend/rules/no-logical-operators-in-jsx.md` - No ternary or logical operators (&&, ||) in JSX.
- `.agent/skills/retend/rules/function-children-as-component.md` - Render function children as components.
- `.agent/skills/retend/rules/combine-scopes-keys.md` - Use `[Scope.key]` for combined scopes.
- `.agent/skills/retend/rules/component-pascal-case.md` - Use PascalCase for components.
- `.agent/skills/retend/rules/hoist-handlers.md` - Hoist event handlers.
- `.agent/skills/retend/rules/prefer-router-navigation.md` - Use router for navigation.

### retend-web
- **Path**: `.agent/skills/retend-web/`
- **Description**: Web-specific features for Retend. Use when building web applications with Retend.

**References**:
- `.agent/skills/retend-web/references/setup.md` - Renderer initialization and configuration.
- `.agent/skills/retend-web/references/attributes-and-events.md` - Guide to classes, styles, and event handling.
- `.agent/skills/retend-web/references/event-modifiers.md` - Detailed reference for all event modifiers.
- `.agent/skills/retend-web/references/components.md` - Teleport, ShadowRoot, and other web-specific components.
- `.agent/skills/retend-web/references/hydration.md` - Enabling and managing hydration.

**Rules**:
- `.agent/skills/retend-web/rules/class-attribute-syntax.md` - No string concat or ternaries for classes.
- `.agent/skills/retend-web/rules/component-class-merging.md` - Merge classes with props correctly.

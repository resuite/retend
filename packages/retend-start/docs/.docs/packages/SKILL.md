---
name: packages
description: Retend package development rules for starter projects. Use for app code, routing, async state, retend-web features, and code review.
---

# Packages

Use this skill for any Retend application work in this project.

Prefer retrieval-led reasoning. Read the smallest relevant file instead of relying on memory.

## Start Here

Read these first:

1. `react-migration-patterns.md`
2. `jsx-reactivity-patterns.md`
3. `common-anti-patterns.md`

Then load only the topic you need:

- `derived-cells-complete-guide.md`
- `control-flow-patterns.md`
- `component-structure-patterns.md`
- `routing-patterns.md`
- `_quick-reference.md`

## Non-Negotiable Rules

- Do not import from `react` or `react-dom`.
- Do not use React hooks or dependency arrays.
- Do not call `.get()` in JSX. Pass Cells directly.
- Do not use ternaries, `&&`, `||`, or `.map()` in JSX. Use `If`, `For`, `Switch`, and `Await`.
- Keep `Cell.derived()` and `Cell.derivedAsync()` pure.
- Use array or object syntax for dynamic `class` values.
- Merge component classes with array syntax.
- Use `Link` and `router.navigate()` for internal navigation.
- Handle pending and error states for async work.

## Review Checklist

Use this when auditing or refactoring code:

1. Reactivity: no `.get()` in JSX, no manual snapshot rendering.
2. Async: use `derivedAsync`, `task`, and `Await` instead of manual `.then()` plus `.set()`.
3. Control flow: use `If`, `For`, and `Switch` instead of inline operators.
4. Structure: PascalCase components, destructure props in the body, hoist handlers.
5. Web rules: camelCase events, correct `class` syntax, safe class merging.
6. Side effects: no side effects in derived cells.

## References

- `references/cells-api.md`
- `references/control-flow.md`
- `references/scopes.md`
- `references/element-references.md`
- `references/retend-utils.md`
- `references/web-setup.md`
- `references/attributes-and-events.md`
- `references/event-modifiers.md`
- `references/web-components.md`
- `references/hydration.md`
- `references/advanced-components.md`

## Rules

- `rules/_index.md` is the central rule index.
- Use the individual files in `rules/` only when you need a specific rule or fix.

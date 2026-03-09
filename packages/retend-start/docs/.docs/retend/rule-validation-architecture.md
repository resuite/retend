# Modern Rule Validation Tool

## Philosophy

**Do not duplicate TypeScript's job.** TypeScript should keep handling type errors and invalid APIs.

**Focus custom validation on what TypeScript misses:**

- Semantic Retend mistakes that still compile
- React habit regressions
- Performance anti-patterns
- Retend-specific style rules with clear value

## Architecture

Use **Oxlint as the default engine** and put Retend rules in a **local JS plugin**.

This keeps the fast path fast:

- `oxlint` handles file walking, parsing, diagnostics, and output
- Retend adds only framework-specific rules
- Type-aware checks stay in a separate pass when they are truly needed

## Default Stack

Every new Retend project should include:

- `oxlint` in `devDependencies`
- `lint` script in `package.json`
- `.oxlintrc.json`
- `retend-oxlint-plugin.mjs`

## First Rule

Start with `retend/no-get-in-jsx`.

Why this rule comes first:

- It is common
- It is high impact
- It is easy to express with AST
- Regex catches it poorly in nested cases

The rule should report `.get()` only when the call is inside a JSX expression and not inside a nested function callback.

## Rule Selection

Put a rule in the Oxlint plugin when all of these are true:

- The rule is Retend-specific
- The rule can be decided from syntax and ancestry
- The rule should run on every file quickly

Examples:

- `.get()` in JSX
- ternaries in JSX
- `&&` and `||` in JSX
- `.map()` in JSX
- `window.location` for navigation
- `htmlFor` instead of `for`
- missing `type` on `<button>`

Keep a rule out of the fast path when it needs:

- type resolution
- symbol tracking across files
- expensive data flow

Those should run in a second typed pass only.

## Authoring Pattern

Each Retend rule should provide:

- stable rule id
- one precise diagnostic
- low false positive behavior
- a fix suggestion when the replacement is obvious

Use parent traversal to avoid naive matches. For example, `.get()` inside `onClick={() => count.get()}` must not be reported just because the handler sits inside JSX.

## Migration Plan

1. Keep using Oxlint for general linting.
2. Move high-signal Retend checks into the local plugin.
3. Remove regex rules only after an AST rule replaces them.
4. Add typed checks later for the few rules that need them.

## Current Baseline

The scaffold now ships a working Oxlint plugin with `retend/no-get-in-jsx` enabled by default.

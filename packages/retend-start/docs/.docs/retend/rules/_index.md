---
description: Machine-readable index of Retend rules with detection hints and quick fixes.
---

# Rules Index

This index centralizes detection hints so rule files can stay concise.

## Schema

- `id`: filename without extension
- `impact`: CRITICAL | HIGH | WARNING | STYLE (see rule file header)
- `docs`: rule doc path
- `detection`: regex/AST hint or `manual`
- `autofix`: short guidance or `manual`

## Reactivity & JSX

| id                             | impact   | docs                                    | detection                                                 | autofix                                    |
| ------------------------------ | -------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| pass-cells-directly            | CRITICAL | rules/pass-cells-directly.md            | JSX contains `.get()`                                     | remove `.get()` in JSX, pass Cell directly |
| no-get-in-jsx                  | CRITICAL | rules/no-get-in-jsx.md                  | `\{[^}]*\.get\(\)`                                        | remove `.get()` in JSX                     |
| derived-outside-jsx            | CRITICAL | rules/derived-outside-jsx.md            | `\{\s*Cell\.derived`                                      | move derived to component body             |
| derivedAsync-outside-jsx       | CRITICAL | rules/derivedAsync-outside-jsx.md       | `\{\s*Cell\.derivedAsync`                                 | move derivedAsync to component body        |
| derived-cells-readonly         | CRITICAL | rules/derived-cells-readonly.md         | `.set(` on derived                                        | set source cell instead                    |
| derivedAsync-readonly          | CRITICAL | rules/derivedAsync-readonly.md          | `.set(` on derivedAsync                                   | set source cell instead                    |
| pure-derived-cells             | HIGH     | rules/pure-derived-cells.md             | side effects inside derived                               | move effects to listeners                  |
| derivedAsync-pure-function     | HIGH     | rules/derivedAsync-pure-function.md     | side effects inside derivedAsync                          | move effects to listeners                  |
| no-direct-get-in-derivedAsync  | CRITICAL | rules/no-direct-get-in-derivedAsync.md  | `derivedAsync\([^)]*\)\s*=>[\s\S]*\.get\(`                | use `get(cell)` param                      |
| derivedAsync-use-get-param     | CRITICAL | rules/derivedAsync-use-get-param.md     | `derivedAsync\s*\(\s*async\s*\([^)]*\)` with unused `get` | use `get(cell)`                            |
| derivedAsync-from-derivedAsync | WARNING  | rules/derivedAsync-from-derivedAsync.md | `Cell\.derived\(\s*\(\)\s*=>\s*.*derivedAsync`            | use derivedAsync for async chaining        |
| use-peek                       | WARNING  | rules/use-peek.md                       | `.peek()` used in derived incorrectly                     | use `.get()` for dependencies              |
| keep-cells-granular            | WARNING  | rules/keep-cells-granular.md            | large object in `Cell.source({ ... })`                    | split into smaller cells                   |
| composite-for-related-data     | WARNING  | rules/composite-for-related-data.md     | `Cell.composite` on unrelated                             | group related async cells                  |

## Control Flow & Lists

| id                               | impact   | docs                                      | detection                         | autofix                      |
| -------------------------------- | -------- | ----------------------------------------- | --------------------------------- | ---------------------------- | ------------------- |
| use-builtin-control-flow         | CRITICAL | rules/use-builtin-control-flow.md         | ternary or `.map()` in JSX        | replace with `If` / `For`    |
| no-logical-operators-in-jsx      | CRITICAL | rules/no-logical-operators-in-jsx.md      | `\{[^}]\*(&&                      | \|\|)`                       | replace with `If()` |
| prefer-switch-for-multiple-cases | WARNING  | rules/prefer-switch-for-multiple-cases.md | nested If for 3+ cases            | use `Switch()`               |
| prefer-if-object-syntax          | WARNING  | rules/prefer-if-object-syntax.md          | `If(cond, () => ..., () => ...)`  | use `{ true, false }` object |
| no-manual-keys-on-for-children   | STYLE    | rules/no-manual-keys-on-for-children.md   | `key=` inside For child           | remove manual key            |
| key-for-items                    | CRITICAL | rules/key-for-items.md                    | `For(` over objects without `key` | add `{ key: 'id' }`          |
| for-index-is-cell                | WARNING  | rules/for-index-is-cell.md                | `index + 1` without `.get()`      | use `index.get()` or derived |
| for-pass-cell-to-children        | WARNING  | rules/for-pass-cell-to-children.md        | keyed `For` passes snapshot       | pass `Cell<Item>`            |
| pure-render-callbacks            | WARNING  | rules/pure-render-callbacks.md            | side effects in render callbacks  | move effects to listeners    |

## Component Structure & Types

| id                             | impact  | docs                                    | detection                     | autofix                               |
| ------------------------------ | ------- | --------------------------------------- | ----------------------------- | ------------------------------------- |
| component-pascal-case          | WARNING | rules/component-pascal-case.md          | `function [a-z]` used as JSX  | rename to PascalCase                  |
| component-structure            | STYLE   | rules/component-structure.md            | mixed order of state/handlers | reorder sections                      |
| destructure-props-in-body      | STYLE   | rules/destructure-props-in-body.md      | heavy destructuring in params | move to body (preferred)              |
| explicit-children-type         | WARNING | rules/explicit-children-type.md         | children prop untyped         | use `JSX.Children`                    |
| no-any                         | WARNING | rules/no-any.md                         | `: any`                       | replace with proper type or `unknown` |
| hoist-handlers                 | WARNING | rules/hoist-handlers.md                 | inline arrow in JSX           | hoist handler                         |
| function-children-as-component | WARNING | rules/function-children-as-component.md | passing fn children           | render as component                   |
| customizable-components        | STYLE   | rules/customizable-components.md        | manual wrapper props          | extend intrinsic props                |
| fragment-shorthand             | STYLE   | rules/fragment-shorthand.md             | multiple root nodes           | wrap in `<>...</>`                    |

## Events, Attributes & DOM

| id                           | impact  | docs                                  | detection                                  | autofix                         |
| ---------------------------- | ------- | ------------------------------------- | ------------------------------------------ | ------------------------------- | ------ |
| lowercase-event-names        | WARNING | rules/lowercase-event-names.md        | `onclick=` or `onchange=`                  | use `onClick`, `onChange`       |
| use-for-attribute            | STYLE   | rules/use-for-attribute.md            | `htmlFor=`                                 | replace with `for=`             |
| button-type                  | WARNING | rules/button-type.md                  | `<button>` without `type`                  | add `type="button"`             |
| self-closing-tags            | STYLE   | rules/self-closing-tags.md            | `<div></div>` with no children             | use `<div />`                   |
| svg-xmlns                    | WARNING | rules/svg-xmlns.md                    | `<svg>` without `xmlns`                    | add `xmlns` on svg and children |
| refs-on-elements             | WARNING | rules/refs-on-elements.md             | `ref` used without Cell                    | use `Cell<HTMLElement           | null>` |
| onconnected-not-layouteffect | WARNING | rules/onconnected-not-layouteffect.md | layout effect patterns                     | use `onConnected()`             |
| prefer-input-component       | WARNING | rules/prefer-input-component.md       | manual input binding                       | use `Input` component           |
| prefer-event-modifiers       | WARNING | rules/prefer-event-modifiers.md       | manual `event.preventDefault()` in handler | use event modifiers             |

## Routing

| id                        | impact   | docs                               | detection                             | autofix                 |
| ------------------------- | -------- | ---------------------------------- | ------------------------------------- | ----------------------- |
| use-link-component        | WARNING  | rules/use-link-component.md        | `<a href="/internal">`                | use `<Link href>`       |
| prefer-router-navigation  | CRITICAL | rules/prefer-router-navigation.md  | `window.location`                     | use `router.navigate()` |
| avoid-route-names         | WARNING  | rules/avoid-route-names.md         | `navigate({ name: ... })`             | navigate by path        |
| headless-routes           | WARNING  | rules/headless-routes.md           | grouping routes with dummy components | use headless routes     |
| prefer-subtrees           | WARNING  | rules/prefer-subtrees.md           | very large routes array               | split with `subtree`    |
| query-mutations-are-async | WARNING  | rules/query-mutations-are-async.md | `query.set(...)` without `await`      | await mutations         |

## Tasks & Async

| id                             | impact  | docs                                    | detection                               | autofix                |
| ------------------------------ | ------- | --------------------------------------- | --------------------------------------- | ---------------------- |
| task-define-at-component-level | WARNING | rules/task-define-at-component-level.md | `Cell.task()` inside handler            | move to component body |
| task-handle-pending-and-error  | WARNING | rules/task-handle-pending-and-error.md  | missing `.pending` or `.error` handling | add If handling        |
| task-not-for-auto-refresh      | WARNING | rules/task-not-for-auto-refresh.md      | periodic refresh using task             | use derivedAsync       |
| task-use-abort-signal          | WARNING | rules/task-use-abort-signal.md          | fetch without signal in task            | pass `signal`          |
| derivedAsync-use-abort-signal  | WARNING | rules/derivedAsync-use-abort-signal.md  | fetch without signal                    | pass `signal`          |
| derivedAsync-handle-pending    | WARNING | rules/derivedAsync-handle-pending.md    | missing `.pending` handling             | add If(pending)        |
| derivedAsync-handle-errors     | WARNING | rules/derivedAsync-handle-errors.md     | missing `.error` handling               | add If(error)          |

## React Migration Guards

| id                        | impact   | docs                               | detection                                   | autofix                 |
| ------------------------- | -------- | ---------------------------------- | ------------------------------------------- | ----------------------- | ----------------------- | -------- | --- | ----------- | ------------------------ |
| no-react-hooks            | CRITICAL | rules/no-react-hooks.md            | `\buse(State                                | Effect                  | Memo                    | Callback | Ref | Context)\b` | use Cells/onSetup/listen |
| no-react-imports          | HIGH     | rules/no-react-imports.md          | `from ['"]react(-dom)?['"]`                 | remove React imports    |
| no-usememo-usecallback    | WARNING  | rules/no-usememo-usecallback.md    | `useMemo                                    | useCallback`            | use derived or plain fn |
| no-re-render-optimization | WARNING  | rules/no-re-render-optimization.md | `memo                                       | shouldComponentUpdate`  | remove optimization     |
| no-dependency-arrays      | CRITICAL | rules/no-dependency-arrays.md      | `derived\([^)]*,\s*\[`                      | remove dependency array |
| no-listen-in-onSetup      | CRITICAL | rules/no-listen-in-onSetup.md      | `onSetup\(\s*\(\)\s*=>\s*\{[\s\S]*\.listen` | call listen directly    |
| top-level-hooks           | WARNING  | rules/top-level-hooks.md           | hook calls in nested scopes                 | move to top level       |

## Web-Specific (retend-web)

| id                      | impact  | docs                                           | detection                         | autofix                 |
| ----------------------- | ------- | ---------------------------------------------- | --------------------------------- | ----------------------- |
| class-attribute-syntax  | WARNING | ../retend-web/rules/class-attribute-syntax.md  | string concat or ternary in class | use array/object syntax |
| component-class-merging | WARNING | ../retend-web/rules/component-class-merging.md | class prop overwritten            | merge classes           |

## Manual Review Rules

These rules are context-heavy and best handled by review or higher-level tooling:

- `prefer-scopes`
- `reactive-props`
- `component-scoped-listeners`
- `unique-component-ids`
- `teleport-selector-limitations`

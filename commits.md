# Commits since main (grouped into consecutive content batches)

## Retend docs tooling
- 28fcb9b Oxlint and Oxfmt
- d93f7a1 feat(retend-docs): Add code formatting and linting tooling

## Retend docs UI components
- 4d9ea65 Refactor: Introduce Card and SectionHeader components

## Retend docs package
- 618581d feat: Add retend-docs package with new website

## Skills and minor docs fixes
- fb75d9c feat: Add Retend code review skill and audit script
- 6391d30 Fix incorrect docs

## RenderToDOM refactor and early tests
- 3ed0d40 Refactor rendering logic into `renderToDOM`
- 05e2f78 More tests and ClientOnly
- 4c301e1 More Hydration tests

## Server SPA context setup
- 6adc08d Add global context in server SPA mode.

## Observer and Await cleanup
- cbb78de Add more observer tests
- c291c05 Rename useObserver to onConnected
- d5f77e3 Fix Await tests

## Async hydration lock and observer fixes
- b48d21e Implement async hydration state locking
- 67aa7c3 Fix observer tests

## Redirects support
- fa2e8a5 Add maxRedirects support

## Hydration suite updates and out-of-order coverage
- 59b7a30 Update hydration test suite
- 8cd329a Update hydration test suite
- 8fd63dc Out of order Hydration
- 774a09e Out of order Hydration

## Switch async behavior fix
- 01e39cf Fix Switch async behaviour

## Test runner parallelism
- 66fac73 Feat: Enable file parallelism in Vitest

## JSX/utils stack refactor
- 0f36248 Refactor jsx and utils to use a stack

## Test infra and package manager changes
- 4b129e8 Install Playwright for retend-test-suite
- cc90bf9 Refactor: Switch to pnpm
- 5067e13 Remove lockfiles and icon

## Hydration/rendering robustness refactors
- 1841e05 Refactor hydration logic and fix language server configuration
- 16ef601 Refactor: Remove unnecessary currentBranch state
- 1b76f09 Fix: Improve hydration robustness with dynamic content
- e145a30 Fix: Await endHydration in restoreContext
- 976b8bc Fix: Assign current branch in render()
- e68c2c3 Refactor DOMRenderer handleComponent and scope getState
- 6252606 Fix: improve dynamic node hydration
- 642c88a Pass StateSnapshot to handleComponent

## Effect node and async holder maintenance
- 442828b Add hierarchical IDs to EffectNode
- 264a2b3 Add cleanup for async holder

## State snapshot API reshaping
- b5ba9d8 Rename createStateSnapshot to branchState
- 49dc6c2 Remove redundant snapshot argument from useScopeContext
- 6f3e1c2 Refactor scope snapshots to state snapshots

## Promise handling in waitUntil
- 109e86b Fix: Make waitUntil return a promise

## Scope chain refactor
- dbe65aa Refactor: Use scope chain instead of Map

## Docs refresh
- 5226a5a Update docs and examples for clarity and accuracy

## Consistent values removal and scope/provider tweaks
- 43bf16a Store active renderer directly in the global context instead of globalData.
- 3e64a76 Update scope state immutably
- 4fe4f8a Refactor scope provider to manage single value
- 6c23285 Remove consistent values feature
- bd9d364 Refactor: Move consistent values to globalData
- 7ce3a45 Remove unused `useConsistent` import

## SSR async boundary and renderToString adjustments
- db19457 Add support for SSR async boundary waiting
- e9ad03f Update doc file paths
- e088001 Remove async from renderToString
- 7b1517e Remove explicit Promise handling

## Async testing and Await component work
- a676886 Refactor: Use vi.advanceTimersByTimeAsync in async tests
- a016203 Refactor Await component to use onSetup
- bbf96f8 feat: Add Await component for async rendering

## Router and scope API refactors
- fbe26a5 Refactor router and ShadowRoot imports
- 5d1f373 Remove unused scope documentation and rules
- 3c2e478 Refactor router and scope API for clarity

## Hydration error fixes and tests
- 068fd03 Fix hydration errors in DOM rendering
- 7ff10fe Add Hydration Tests
- 5905393 Add hydration test for fragment children in shadowroots
- 709dd31 Fix Shadowroot hydration tests
- f178ed8 Fix: Improve children rendering in Teleport

## Repo prompts ignore
- 4fb2245 Add prompts to .gitignore

## Render element cleanup
- 3143581 Refactor: Remove unused renderElement helper

## Async component handling
- c199c58 feat: Handle asynchronous components
- 7688fdf feat: Handle async components

## Router fix and renderer refactors
- 4cd639f Fix(router): Correct scope provider to accept direct children
- c9dc4fe Refactor For, If, and Switch to use factory functions
- 876bfb4 Refactor: Use renderer.handleComponent for components

## API renames and breaking changes
- 5faabc5 Rename useSetupEffect to onSetup
- 9bf82bd Rename Cell.createComposite to Cell.composite
- d12604e Replace AsyncDerivedCell with AsyncCell
- 7d3d9ed Remove deep option from Cell.source in use-storage

## Cell docs, deps, and guides
- 800ab36 Document Cell.task and Cell.createComposite
- 4c68fd1 Update playwright to 1.58.1
- cf63c96 Remove glob dependency
- 38cfecc Update @adbl/cells dependency
- 2618f30 Add Retend guides and validation architecture
- 81c5213 Add documentation and rules for Cell.derivedAsync

## Merges and async cell tests
- 7852501 Merge branch 'skills' into test-derived-async
- 0529cbd Update @adbl/cells dependency
- fa8a729 Add tests for asynchronous cell reactivity
- c9d758f Remove asynchronous rendering tests
- 4e7334f Update @adbl/cells dependency version
- 9ab0603 Merge branch 'main' into test-derived-async

## Async data handling for JSX and control flow
- e0e0c66 feat: Add asynchronous data handling to `For` and `If` components, enabling them to react to `Promise` and `AsyncDerivedCell` values.
- e8551cd Support asynchronous JSX attributes
- 2a92b89 Support Promise values in cells and attributes

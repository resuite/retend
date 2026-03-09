# Reactivity

## Rules

- **Pass Cells Directly**: Never call `.get()` inside JSX curly braces.
  - ✅ `<div>{count}</div>`
  - ❌ `<div>{count.get()}</div>` (static snapshot, breaks reactivity)
- **.get() Usage**: Use `.get()` in `Cell.derived()`, event handlers, or side effects (`.listen()`).
- **No Dependency Arrays**: `Cell.derived()` tracks automatically. No second argument array.
- **Read-Only**: Never call `.set()` on a derived cell.
- **Outside JSX**: Define `Cell.derived()` in component body, not inline in JSX.
- **Batching**: Use `Cell.batch(() => { ... })` for multiple updates.

## Common Patterns

- **Toggle**: `isOpen.set(!isOpen.get())`
- **Counter**: `count.set(count.get() + 1)`
- **Derived Filtering**: `const filtered = Cell.derived(() => items.get().filter(...))`
- **Async Derived Values**: See **[Async](async.md)**.

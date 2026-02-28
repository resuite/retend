# Async

## Rules
- **All Async Through Primitives**: ANY async operation (fetching, computation, initialization) MUST use `Cell.derivedAsync()` or `Cell.task()`. NEVER use manual `Cell.source()` + `.then()` patterns.
  - ✅ `const html = Cell.derivedAsync(async () => highlight(code))`
  - ❌ `const html = Cell.source(''); doAsync().then(v => html.set(v))`
- **Use <Await /> for Coordination**: Use `<Await />` to pause rendering of a subtree until all nested async cells have resolved.
- **derivedAsync get() parameter**: Always use `get` function from first parameter. Never call `.get()` directly.
  - ✅ `Cell.derivedAsync(async (get) => fetchUser(get(userId)))`
  - ❌ `Cell.derivedAsync(async () => fetchUser(userId.get()))` (breaks tracking)
- **AbortSignal**: Always pass `signal` parameter to `fetch()` or other cancellable operations.
- **derivedAsync is Pure**: No side effects (logging, POST requests, etc.). Use `.listen()` for side effects.
- **Handle Pending & Error**: Always handle `.pending` and `.error` cells for `derivedAsync` and `task` unless wrapped in `<Await />`.
- **Chaining**: To derive from an `AsyncDerivedCell`, use `Cell.derivedAsync()` and `await get(otherAsyncCell)`.
- **Cell.task()**: Use for actions (POST, PUT, DELETE). Does NOT auto-refresh on dependency changes. Define at component level.
- **Cell.composite()**: Groups related async cells. Settlements occur together.
- **.pending vs .loaded**:
  - `.pending`: `true` while ANY cell is loading (flickers during refresh).
  - `.loaded`: `true` after first success (stays true during refresh, better for "stale-while-revalidate" UI).

## Decisions
- **Coordinate multiple subtrees?** -> `<Await fallback={...}>`
- **Any async computation (pure)?** -> `Cell.derivedAsync(async (get, signal) => ...)`
- **User Action (mutations/side effects)?** -> `Cell.task(async (input, signal) => ...)`

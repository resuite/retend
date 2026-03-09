# Anti-Patterns & Migration

## CRITICAL Anti-Patterns

- **.get() in JSX**: Never call `.get()` in JSX curly braces. Use Cell directly.
- **React Hooks**: No `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`.
- **Dependency Arrays**: No dependency arrays for `Cell.derived()`, `Cell.derivedAsync()`, or `onSetup()`.
- **Ternary Operators in JSX**: Never use `? :` for conditional rendering in JSX. Use `If()` or `Switch()`.
- **Logical Operators in JSX**: Never use `&&` or `||` for conditional rendering in JSX. Use `If()`.
- **Expression for Static Classes**: Never use Array/Object syntax (`class={['a', 'b']}`) for purely static classes. Use simple strings (`class="a b"`).
- **.map() for Lists**: Never use `.map()` in JSX. Use `For()`.
- **No Keys in For with Objects**: Always provide a `key` for `For()` with object arrays.
- **derivedAsync Without get Parameter**: Never use `.get()` directly inside `Cell.derivedAsync()`.
- **Setting Derived Cells**: Never call `.set()` on a derived cell.
- **Window Location Navigation**: Never use `window.location` for internal navigation. Use `router.navigate()`.
- **lowercase Component Names**: Component functions MUST be PascalCase.
- **htmlFor Instead of for**: Use `for` attribute for labels.
- **svg Without xmlns**: All elements within an SVG must have `xmlns`.
- **.listen() Inside onSetup()**: Call `.listen()` directly in component body.
- **Query mutations not awaited**: Query mutations are async and must be awaited.
- **Manual .then() + .set()**: Never use `promise.then(v => cell.set(v))`. Use `Cell.derivedAsync()` instead.

## React Migration Checklist

- [ ] Replaced `useState` with `Cell.source()`
- [ ] Replaced `useEffect` with `.listen()` or `onSetup()`
- [ ] Replaced `useMemo` with `Cell.derived()`
- [ ] Removed all dependency arrays
- [ ] Replaced `? :` and `&&` with `If()`
- [ ] Replaced `.map()` with `For()`
- [ ] Replaced `htmlFor` with `for`
- [ ] Replaced expressions for static classes with simple strings
- [ ] Replaced `window.location` with `router.navigate()`
- [ ] Ensured component functions only run once
- [ ] Verified `.get()` is not called inside JSX
- [ ] Passed Cells directly to JSX
- [ ] Verified `derivedAsync` uses `get` parameter
- [ ] Verified `For` with objects uses `key` option
- [ ] Ensured event handlers are hoisted functions
- [ ] Verified `JSX.Children` type usage
- [ ] Verified `ValueOrCell<T>` for reactive props
- [ ] Verified `onConnected` for DOM access
- [ ] Awaited `query.set()` etc.
- [ ] Added `xmlns` to SVGs
- [ ] Wrapped multiple root elements in `<>...</>`
- [ ] Specified `type="button"` on all buttons
- [ ] Ensured component names are PascalCase

# Routing

## Rules

- **Always Use Router Navigation**: Always use `router.navigate()`, `router.replace()`, or `router.back()`. Never use `window.location` or `window.history` directly.
  - ✅ `const router = useRouter(); router.navigate('/home');`
  - ❌ `window.location.href = '/home';` (full page reload, wipes application state)
- **Use Link Component**: Use the `Link` component from `retend/router` for internal navigation.
  - ✅ `<Link href="/about">About</Link>`
  - ❌ `<a href="/about">About</a>` (full page reload)
- **Query Parameters are Async**: Query mutations (`set`, `append`, `delete`, `clear`) are asynchronous and return Promises. Always await them.
  - ✅ `const handleFilter = async (val) => { await query.set('filter', val); ... };`
  - ❌ `const handleFilter = (val) => { query.set('filter', val); ... };` (race condition)
- **Reactive Params & Query**: Use `useCurrentRoute()` for params and `useRouteQuery()` for query. Their values are reactive Cells.
  - ✅ `const route = useCurrentRoute(); const userId = route.get().params.get('userId');`
  - ✅ `const searchTerm = query.get('q');`
- **Headless Routes for Structure**: Use headless routes (routes with `children` but no `component`) to group related paths.
- **Prefer Subtrees for Large Apps**: Use `subtree` with `defineRoute` and `lazy` to split route configurations into separate modules.
- **Navigate by Path**: Navigate by path string, not by route name. Avoid using the `name` property on routes.
- **Dynamic Route Params**: Use `:paramName` syntax in path definitions and access via `useCurrentRoute().get().params.get('paramName')`.

## Patterns

- **Outlet**: Use `<Outlet />` to render matched child routes in parent components.
- **Lazy Loading**: Lazy load route components for performance.
- **Wildcard Routes**: Use `*` to match any path (typically for 404 pages).
- **Stack Mode**: Enable `stackMode: true` for stack-based navigation.
- **Middleware**: Use `defineRouterMiddleware` to intercept navigation for auth guards, logging, etc.

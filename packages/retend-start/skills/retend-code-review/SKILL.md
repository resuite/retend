---
name: retend-code-review
description: 'Review, audit, or refactor Retend code. Triggers: (1) Reactivity correctness (Cells), (2) React anti-patterns (hooks, .map(), .get() in JSX), (3) Component structure/props, (4) Control flow (If, For, Switch, Await), (5) Routing patterns.'
---

# Retend Code Review

## Quick Audit

1. **Reactivity**: No `.get()` in JSX. Pass Cells directly.
2. **Async**: Use `derivedAsync`/`task`/`<Await />` for ALL async. No manual `.then()` + `.set()` patterns.
3. **Control Flow**: Use `If`/`For`/`Switch`. No ternaries or `&&` in JSX.
4. **Anti-Patterns**: No React hooks or dependency arrays.
5. **Structure**: PascalCase, destructured props, hoisted handlers.
6. **Web**: camelCase events (`onClick`).
7. **Class Attribute**: Choose the right syntax for the situation:
   - **String** for fully static classes: `class="btn btn-primary"`
   - **Array** when combining multiple sources: `class={['btn', variant]}`
   - **Object** for conditional toggling (Vue-style): `class={{ 'is-active': isActive }}`
   - **Mixed** for complex cases: `class={['btn', variant, { 'is-active': isActive }]}`
   - ❌ Never use string concatenation, ternaries, or `Cell.derived()` that returns class strings.

## Patterns

- `\.get\(` in JSX - `.get()` in JSX (Critical)
- `\{[^}]*(\?|&&|\|\|)` - Inline logic (Critical)
- `class=\{['"][^}]*\+` - String concatenation for classes (Critical)
- `class=\{[^}]*\?[^}]*:` - Ternary for classes (Critical)
- `Cell\.derived.*class` - Derived Cell returning class string (Warning -> use object syntax)
- `class=\{\[[^\]]*\]\}` where all items are string literals - Static array (Warning -> use plain string)
- `\.map\(` - `.map()` in JSX (Critical -> `For()`)
- `derivedAsync\([^)]*\)\s*=>[\s\S]*\.get\(` - direct `.get()` in `derivedAsync` (Critical -> `get(cell)`)
- `Cell\.source\((true|false|null)\)[\s\S]*fetch\(` - Manual loading cells (Warning)
- `\.then\([^)]*\.set\(` - Manual `.then()` + `.set()` (Critical -> `derivedAsync`)
- `\buse(State|Effect|Memo|Callback|Ref|Context)\b` - React hooks (Critical)

## Automated Audit Script

The skill includes a `scripts/audit.py` tool to automate these checks across a file or directory.

**Usage:**

```bash
python3 scripts/audit.py <path/to/src>
```

## References

- **[Reactivity](references/reactivity.md)**: Cells, derived.
- **[Async](references/async.md)**: `derivedAsync`, `task`, `composite`, `<Await />`.
- **[Components](references/components.md)**: Structure, props, naming.
- **[Control Flow](references/control-flow.md)**: `If`, `For`, `Switch`.
- **[Routing](references/routing.md)**: Navigation, params, query.
- **[Web](references/web-specifics.md)**: Attributes, events, `retend-web`.
- **[Anti-Patterns](references/anti-patterns.md)**: Migration checklist.

| title               | impact   | impactDescription                                                       | tags                        |
| :------------------ | :------- | :---------------------------------------------------------------------- | :-------------------------- |
| Pass Cells Directly | CRITICAL | Maintains reactivity by allowing the framework to subscribe to updates. | components, reactivity, jsx |

# Pass Cells Directly

**Context**: Binding Cells in JSX (text nodes, attributes, class, style).

**Rule**: Pass the Cell object directly to JSX. Do NOT call `.get()` inside JSX.

**Why**:

- **Reactivity**: `.get()` returns a snapshot and breaks subscriptions. Passing the Cell lets Retend track changes.
- **Performance**: Direct Cells keep updates granular and avoid re-running render logic.

## Detection

**Triggers**:

- JSX expressions containing `.get()` (for example `{cell.get()}`)
- JSX attributes using `.get()` (for example `value={cell.get()}`)

## Examples

### Invalid

```tsx
const count = Cell.source(0);
const text = Cell.source('Hello');

// ❌ WRONG - loses reactivity
<div>{count.get()}</div>
<input value={text.get()} />
<div class={count.get() > 0 ? 'active' : ''} />
```

### Valid

```tsx
const count = Cell.source(0);
const text = Cell.source('Hello');
const isActive = Cell.derived(() => count.get() > 0);

// ✅ CORRECT - pass Cells directly
<div>{count}</div>
<input value={text} />
<div class={isActive} />
```

## Auto-Fix

- Remove `.get()` calls inside JSX and pass the Cell directly.
- If you need a transformed value, create a `Cell.derived()` in the component body and pass that Cell into JSX.

## Related Rules

- `no-get-in-jsx`
- `jsx-reactivity-patterns`

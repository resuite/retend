| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Await useConsistent  | Medium | Prevents promise handling errors.                      | ssr, hydration, async       |

# Await useConsistent

**Context**: Generating consistent values between server and client.

**Rule**: Always await `useConsistent()` calls. They return Promises.

**Why**:

- `useConsistent()` is asynchronous
- Used for SSR/hydration consistency
- Generates or retrieves values that must match on server and client

## Examples

### Invalid

```tsx
// INVALID - not awaiting
function Component() {
  const id = useConsistent('item-id', () => crypto.randomUUID());
  // id is a Promise, not the value!
  
  return <div id={id}>Item</div>; // [object Promise]
}
```

### Valid

```tsx
// VALID - awaiting the promise
async function Component() {
  const id = await useConsistent('item-id', () => crypto.randomUUID());
  // id is the actual string value
  
  return <div id={id}>Item</div>;
}

// VALID - in component context
async function TodoItem() {
  const id = await useConsistent('todo-item', () => generateId());
  const createdAt = await useConsistent('created', () => Date.now());
  
  return (
    <div data-id={id} data-created={createdAt}>
      <input type="checkbox" />
      <span>Todo Item</span>
    </div>
  );
}
```

## How useConsistent Works

```tsx
// On server: generates and stores value
// On client: retrieves the stored value
const id = await useConsistent('unique-key', factoryFunction);
```

- **Server**: Calls factory function, stores result, returns value
- **Client**: Retrieves stored value (must match server)
- **One-time use**: Key is deleted after reading

## When to Use

Use `useConsistent` for values that must be identical on server and client:

1. **Random IDs** - crypto.randomUUID()
2. **Timestamps** - Date.now() during initial render
3. **Random data** - Math.random() results
4. **Any non-deterministic value**

## SSR/Hydration Without Consistent Values

```tsx
// Server renders: <div id="abc-123">
// Client generates: id = "xyz-789"
// Result: Hydration mismatch!

// With useConsistent:
// Server generates: "abc-123", stores it
// Client retrieves: "abc-123"
// Result: Consistent hydration
```

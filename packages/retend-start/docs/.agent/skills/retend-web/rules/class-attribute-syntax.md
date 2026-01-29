| title                  | impact | impactDescription                                          | tags                           |
| :--------------------- | :----- | :--------------------------------------------------------- | :----------------------------- |
| Class Attribute Syntax | Medium | Prevents styling bugs and discourages inline conditionals. | styling, safety, best-practice |

# Class Attribute Syntax

**Rule**:

- **NEVER** use string concatenation for classes (e.g., `'btn ' + type`).
- **NEVER** use ternary operators for classes (e.g., `isActive ? 'active' : ''`).
- **ALWAYS** use the built-in Array or Object syntax.

**Why**:

- **Safety**: Prevents missing whitespace bugs.
- **Readability**: Declarative syntax is easier to parse than complex inline logic.
- **No Side Effects**: Object keys are only applied if values are truthy, handling "empty" strings automatically.

## Examples

### Invalid

```tsx
// String Concatenation
<div class={'btn ' + variant} />

// Ternary Operator
<div class={isActive ? 'params-active' : ''} />
<div class={`btn ${isActive ? 'active' : ''}`} />
```

### Valid

```tsx
// Array Syntax
<div class={['btn', variant]} />

// Object Syntax (Conditionals)
<div class={['btn', { 'params-active': isActive }]} />

// Mixed
<div class={['btn', variant, { 'loading': isLoading }]} />
```

| title                | impact | impactDescription                            | tags                        |
| :------------------- | :----- | :------------------------------------------- | :-------------------------- |
| No Ternary Operators | High   | Enforces reactive and readable control flow. | syntax, control-flow, style |

# No Ternary Operators

**Rule**: Do not use ternary operators (`condition ? true : false`) anywhere in your component's JSX (children or props).

**Why**:

- **Reactivity**: Ternaries break fine-grained reactivity if used with Cells, forcing re-evaluation in broader scopes.
- **Readability**: `If` and `Switch` components are more descriptive and scalable.
- **Consistency**: Retend prioritizes built-in control flow helpers.

## Examples

### Invalid

```tsx
// In JSX Children
<div>
  {isLoggedIn ? <UserMenu /> : <LoginButton />}
</div>

// In Props
<Button variant={isPrimary ? 'solid' : 'outline'} />
```

### Valid

```tsx
// Use If for Children
<div>
  {If(isLoggedIn, {
    true: () => <UserMenu />,
    false: () => <LoginButton />,
  })}
</div>;

// Use Derived State for Props
// (Define variant outside JSX)
const variant = Cell.derived(() => (isPrimary.get() ? 'solid' : 'outline'));

<Button variant={variant} />;
```

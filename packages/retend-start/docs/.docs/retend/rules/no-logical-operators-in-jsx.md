| title                    | impact | impactDescription                            | tags                        |
| :----------------------- | :----- | :------------------------------------------- | :-------------------------- |
| No Logical Operators in JSX | High   | Enforces reactive and readable control flow. | syntax, control-flow, style |

# No Logical Operators in JSX

**Rule**: Do not use ternary operators (`condition ? true : false`) or short-circuit logical operators (`&&`, `||`) anywhere in your component's JSX (children or props).

**Why**:

- **Reactivity**: Ternaries and logical operators break fine-grained reactivity if used with Cells, forcing re-evaluation in broader scopes.
- **Readability**: `If` and `Switch` components are more descriptive and scalable.
- **Consistency**: Retend prioritizes built-in control flow helpers.
- **Predictability**: Logical operators (`&&`, `||`) can produce unexpected results when dealing with falsy values (0, empty strings, etc.) in JSX.

## Examples

### Invalid

```tsx
// Ternary in JSX Children
<div>
  {isLoggedIn ? <UserMenu /> : <LoginButton />}
</div>

// Ternary in Props
<Button variant={isPrimary ? 'solid' : 'outline'} />

// && operator - can produce unexpected results with falsy values
<div>
  {isVisible && <Modal />}
</div>

// || operator for fallbacks
<div>
  {username || 'Anonymous'}
</div>
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

// Use If for simple conditional rendering
<div>
  {If(isVisible, {
    true: () => <Modal />
  })}
</div>;

// Use Derived State for Props
// (Define variant outside JSX)
const variant = Cell.derived(() => (isPrimary.get() ? 'solid' : 'outline'));

<Button variant={variant} />;

// Use Cell.derived for fallback values
const displayName = Cell.derived(() => username.get() || 'Anonymous');

<div>{displayName}</div>;
```

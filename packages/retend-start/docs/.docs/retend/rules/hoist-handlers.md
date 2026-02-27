| title          | impact | impactDescription                           | tags                            |
| :------------- | :----- | :------------------------------------------ | :------------------------------ |
| Hoist Handlers | Low    | Improves performance and code organization. | performance, style, readability |

# Hoist Handlers

**Rule**: Event handlers and listener definitions should be declared BEFORE they are used (e.g. in `onConnected` or JSX), and preferably outside inline JSX.

**Why**:

- **Clarity**: Separates logic from the view (JSX).
- **Organization**: Keeps the return statement clean and readable.

## Examples

### Invalid

```tsx
<button
  onClick={() => {
    // Complex inline logic...
    doSomething();
    doSomethingElse();
  }}
>
  Click
</button>
```

### Valid

```tsx
const handleClick = () => {
  doSomething();
  doSomethingElse();
};

<button onClick={handleClick}>Click</button>;
```

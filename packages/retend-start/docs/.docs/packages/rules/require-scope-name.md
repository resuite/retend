| title              | impact | impactDescription                             | tags                  |
| :----------------- | :----- | :-------------------------------------------- | :-------------------- |
| Require Scope Name | HIGH   | Makes scope errors and debug output readable. | scopes, debug, errors |

# Require Scope Name

**Rule**: Pass a non-empty string name to `createScope()`.

**Why**:

- **Errors**: Missing-scope messages can identify the scope that failed.
- **Debugging**: Named providers are easier to read in Retend development output.

## Invalid

```tsx
const ThemeScope = createScope<Theme>();
```

## Valid

```tsx
const ThemeScope = createScope<Theme>('Theme');
```

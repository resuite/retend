| title                           | impact | impactDescription                                | tags                      |
| :------------------------------ | :----- | :----------------------------------------------- | :------------------------ |
| No Provider Inline Object Value | HIGH   | Makes scope value shape explicit and reviewable. | scopes, structure, values |

# No Provider Inline Object Value

**Rule**: Do not pass an inline object literal to a scope `Provider` value.

**Why**:

- **Clarity**: Naming the value makes the scope contract visible before JSX.
- **Reviewability**: Scope shape changes are easier to see outside markup.

## Invalid

```tsx
<ThemeScope.Provider value={{ theme, setTheme }}>
  {children}
</ThemeScope.Provider>
```

## Valid

```tsx
const themeScopeValue = { theme, setTheme };

<ThemeScope.Provider value={themeScopeValue}>{children}</ThemeScope.Provider>;
```

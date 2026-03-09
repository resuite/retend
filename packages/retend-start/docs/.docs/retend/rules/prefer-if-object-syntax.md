| title                       | impact | impactDescription                              | tags                          |
| :-------------------------- | :----- | :--------------------------------------------- | :---------------------------- |
| Prefer Object Syntax for If | Medium | Improves readability when both branches exist. | control-flow, if, readability |

# Prefer Object Syntax for If with Else

**Rule**: When `If()` has both branches, use `{ true: ..., false: ... }` instead of positional arguments.

**Invalid**:

```tsx
{
  If(
    condition,
    () => <TrueContent />,
    () => <FalseContent />
  );
}
```

**Valid**:

```tsx
{
  If(condition, {
    true: () => <TrueContent />,
    false: () => <FalseContent />,
  });
}
```

| title                     | impact | impactDescription                                                           | tags                                  |
| :------------------------ | :----- | :-------------------------------------------------------------------------- | :------------------------------------ |
| Use Built-in Control Flow | HIGH   | Provides efficient, granular updates and consistent patterns across codebase. | control-flow, performance, reactivity, consistency |

# Use Built-in Control Flow

**Context**: Rendering lists or conditional content.

**Rule**: Always use `If` and `For` helper functions instead of inline ternary operators or `.map()`. **This applies even to static lists.**

**Why**:

- **Reactivity**: Built-in helpers are optimized to only re-render the changing parts. `.map()` on a Cell re-renders the _entire list_ when one item changes.
- **Performance**: Significant performance gains for large lists.
- **Consistency**: Using `For` everywhere makes the codebase uniform and predictable. Mixing `.map()` and `For` creates visual inconsistency and confusion.
- **Framework Conventions**: Retend is designed around its control flow helpers. Using `.map()` bypasses framework optimizations and established patterns.
- **Future-Proofing**: Static lists often become dynamic. Using `For` from the start avoids refactoring later.

## Examples

### Reactive Lists

```tsx
// Avoid - re-renders entire list on any change
{
  items.get().map((item) => <Item val={item} />);
}

// Good - granular updates
{
  For(items, (item) => <Item val={item} />);
}
```

### Static Lists

```tsx
// Avoid - inconsistent with framework conventions
const staticItems = ['a', 'b', 'c'];
{
  staticItems.map((item) => <span>{item}</span>);
}

// Good - consistent, follows conventions
const staticItems = ['a', 'b', 'c'];
{
  For(staticItems, (item) => <span>{item}</span>);
}
```

### Conditionals

```tsx
// Avoid
{
  isVisible ? <Modal /> : null
}

// Good
{
  If(isVisible, {
    true: () => <Modal />
  })
}
```

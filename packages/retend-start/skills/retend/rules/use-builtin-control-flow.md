| title                     | impact | impactDescription                                                           | tags                                  |
| :------------------------ | :----- | :-------------------------------------------------------------------------- | :------------------------------------ |
| Use Built-in Control Flow | HIGH   | Provides efficient, granular updates compared to re-rendering entire lists. | control-flow, performance, reactivity |

# Use Built-in Control Flow

**Context**: Rendering lists or conditional content.

**Rule**: Use `If` and `For` helper functions instead of inline ternary operators or `.map()`.

**Why**:

- **Reactivity**: Built-in helpers are optimized to only re-render the changing parts. `.map()` on a Cell re-renders the _entire list_ when one item changes.
- **Performance**: Significant performance gains for large lists.

```tsx
// Avoid
{
  items.get().map((item) => <Item val={item} />);
}

// Good
{
  For(items, (item) => <Item val={item} />);
}
```

| title                      | impact | impactDescription                                   | tags                         |
| :------------------------- | :----- | :-------------------------------------------------- | :--------------------------- |
| No Anonymous For Component | HIGH   | Keeps list item state and handlers scoped per item. | lists, components, structure |

# No Anonymous For Component

**Rule**: `For()` callbacks should render a named item component instead of inline JSX markup.

**Why**:

- **Scoped state**: Item cells, handlers, and lifecycle hooks belong inside the item component.
- **Readability**: The list describes what is rendered, while the item component owns the details.

## Invalid

```tsx
For(items, (item) => <li>{item.name}</li>);
```

## Valid

```tsx
function ItemRow(props: { item: Item }) {
  return <li>{props.item.name}</li>;
}

For(items, (item) => <ItemRow item={item} />, { key: 'id' });
```

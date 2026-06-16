| title                           | impact | impactDescription                                   | tags                     |
| :------------------------------ | :----- | :-------------------------------------------------- | :----------------------- |
| Prefer Link For Internal Anchor | HIGH   | Keeps internal navigation inside the Retend router. | routing, navigation, jsx |

# Prefer Link For Internal Anchor

**Rule**: Use `Link` from `retend/router` for internal anchors.

**Why**:

- **Router state**: `Link` lets Retend update navigation state and history consistently.
- **User experience**: Plain anchors can force a full document navigation for app routes.

## Invalid

```tsx
<a href="/settings">Settings</a>
```

## Valid

```tsx
<Link href="/settings">Settings</Link>
```

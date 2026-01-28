| title                | impact | impactDescription                       | tags                        |
| :------------------- | :----- | :-------------------------------------- | :-------------------------- |
| Unique Component IDs | High   | Critical for correct state persistence. | advanced, components, state |

# Unique Component IDs

When using multiple instances of a component created with `createUnique`, you MUST provide a unique `id` prop to each instance to ensure they have independent persistent states.

## Reasoning

`createUnique` components persist their DOM and state based on their `id`. moving or rendering multiple instances without unique IDs will cause them to share the same underlying instance or overwrite each other.

## Examples

### Invalid

```tsx
const VideoPlayer = createUnique(() => <video />);

// Both players share the same instance/state!
<div>
  <VideoPlayer />
  <VideoPlayer />
</div>;
```

### Valid

```tsx
const VideoPlayer = createUnique(() => <video />);

// Distinct instances
<div>
  <VideoPlayer id="player1" />
  <VideoPlayer id="player2" />
</div>;
```

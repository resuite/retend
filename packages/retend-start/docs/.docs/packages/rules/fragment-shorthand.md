| title              | impact | impactDescription                  | tags                   |
| :----------------- | :----- | :--------------------------------- | :--------------------- |
| Fragment Shorthand | Low    | Keeps code concise and consistent. | jsx, syntax, fragments |

# Fragment Shorthand

**Context**: Returning multiple elements without a wrapper.

**Rule**: Use empty tag shorthand `<></>` for fragments. Do not import Fragment.

**Why**:

- More concise than `<Fragment>...</Fragment>`
- No import needed
- Standard JSX syntax
- Works exactly like React's fragment shorthand

## Examples

### Invalid

```tsx
// INVALID - importing Fragment
import { Fragment } from 'retend';

function List() {
  return (
    <Fragment>
      <Item1 />
      <Item2 />
      <Item3 />
    </Fragment>
  );
}
```

### Valid

```tsx
// VALID - shorthand syntax
function List() {
  return (
    <>
      <Item1 />
      <Item2 />
      <Item3 />
    </>
  );
}

// VALID - with keys (if needed, rare)
<>
  <Item key="1" />
  <Item key="2" />
</>;
```

## Common Use Cases

```tsx
// Table rows need wrapper
<table>
  <>
    <tr>
      <td>Row 1</td>
    </tr>
    <tr>
      <td>Row 2</td>
    </tr>
  </>
</table>;

// Conditional rendering with multiple elements
{
  If(showDetails, {
    true: () => (
      <>
        <h3>Details</h3>
        <p>Description here</p>
        <button>Action</button>
      </>
    ),
  });
}

// Return multiple elements from component
function Pair() {
  return (
    <>
      <dt>Term</dt>
      <dd>Definition</dd>
    </>
  );
}
```

## When NOT to Use

Don't use fragments when:

- You need a real wrapper element for styling
- You need to attach refs or event handlers to the wrapper
- The parent has specific child requirements (e.g., `<select>` only accepts `<option>`)

```tsx
// Use real element when styling needed
<div className="card">
  <Title />
  <Content />
</div>

// Don't use fragment for select options
<select>
  {/* Fragments won't work here */}
  <option>1</option>
  <option>2</option>
</select>
```

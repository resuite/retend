| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Prefer Switch for Multiple Cases | Low | Improves readability for multiple branches.            | control-flow, switch        |

# Prefer Switch for Multiple Cases

**Context**: Rendering different content based on multiple possible values.

**Rule**: Use `Switch()` for multiple conditional branches instead of nested ternaries or multiple If statements.

**Why**:

- More readable than nested ternaries
- Cleaner than multiple If statements
- Built-in default case handling
- Scales better as cases grow

## Examples

### Invalid

```tsx
// INVALID - messy with multiple If statements
<div>
  {If(view === 'home', () => <Home />)}
  {If(view === 'about', () => <About />)}
  {If(view === 'contact', () => <Contact />)}
  {If(view !== 'home' && view !== 'about' && view !== 'contact', () => <NotFound />)}
</div>

// INVALID - unreadable nested ternary
<div>
  {view === 'home' 
    ? <Home />
    : view === 'about'
      ? <About />
      : view === 'contact'
        ? <Contact />
        : <NotFound />
  }
</div>
```

### Valid

```tsx
// VALID - clean Switch with explicit default
<div>
  {Switch(
    view,
    {
      home: () => <Home />,
      about: () => <About />,
      contact: () => <Contact />
    },
    () => <NotFound />
  )}
</div>

// VALID - Switch with separate default handler
<div>
  {Switch(view, {
    home: () => <Home />,
    about: () => <About />,
    contact: () => <Contact />
  }, (unknownView) => <p>Unknown: {unknownView}</p>)}
</div>
```

## When to Use Switch

Use `Switch` when:
- You have 3+ conditions
- Conditions are mutually exclusive
- You want a default/fallback case

Use `If` when:
- You have only 2 conditions (true/false)
- Simple binary logic

## Switch.OnProperty

Switch on specific object properties:

```tsx
function UserView({ user }) {
  return Switch.OnProperty(
    user,
    'role',
    {
      admin: () => <AdminDashboard />,
      editor: () => <EditorPanel />,
      viewer: () => <ViewerInterface />
    },
    () => <GuestView />
  );
}
```

## With Cells

Switch works reactively with Cells:

```tsx
const currentView = Cell.source('home');

// Automatically updates when currentView changes
<div>
  {Switch(
    currentView,
    {
      home: () => <Home />,
      about: () => <About />
    },
    () => <NotFound />
  )}
</div>
```

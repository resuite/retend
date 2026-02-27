---
description: Component organization, naming conventions, and structure patterns for maintainable Retend code.
---

# Component Structure Patterns

**Purpose**: Organize components for readability, maintainability, and proper reactivity.

**CRITICAL PRINCIPLE**: Components run once. Structure them to set up reactive Cells and return JSX that subscribes to those Cells.

---

## [CRITICAL] Components Must Be PascalCase

**Applies to**: All component function names

**Rule**: Component names MUST be PascalCase. Lowercase names are treated as HTML elements.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - PascalCase
function UserProfile() { ... }
function NavigationMenu() { ... }
function TodoItem() { ... }

// Usage:
<UserProfile />
<NavigationMenu />
<TodoItem />
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - lowercase
function userProfile() { ... }
function navigation_menu() { ... }

// Usage (WRONG - treated as HTML!):
<userProfile />     {/* Becomes <userprofile> tag */}
<navigation_menu /> {/* Invalid HTML */}
```

**Why**: JSX specification treats lowercase as built-in elements, uppercase as components.

---

## [CRITICAL] Component Structure Order

**Applies to**: All component definitions

**Rule**: Organize components in this strict order:
1. Destructure props
2. State Cells (`Cell.source()`)
3. Derived Cells (`Cell.derived()`, `Cell.derivedAsync()`)
4. Event handlers (hoisted functions)
5. Effects (`onSetup()`, `onConnected()`)
6. Return JSX

**Explicit Pattern**:
```tsx
function UserProfile(props: { userId: Cell<number>; class?: string }) {
  // 1. Destructure props
  const { userId, class: className } = props;
  
  // 2. State Cells
  const isExpanded = Cell.source(false);
  const editMode = Cell.source(false);
  
  // 3. Derived Cells
  const user = Cell.derivedAsync(async (get) => {
    return await fetchUser(get(userId));
  });
  
  const displayName = Cell.derived(() => {
    const u = user.get();
    return u?.name ?? 'Anonymous';
  });
  
  // 4. Event Handlers (all hoisted)
  const handleExpand = () => {
    isExpanded.set(!isExpanded.get());
  };
  
  const handleEdit = () => {
    editMode.set(true);
  };
  
  const handleSave = () => {
    editMode.set(false);
    // Save logic...
  };
  
  // 5. Effects
  onSetup(() => {
    console.log('Component initialized');
    return () => {
      console.log('Component cleanup');
    };
  });
  
  // 6. Return JSX
  return (
    <div class={className}>
      <h1>{displayName}</h1>
      {If(isExpanded, {
        true: () => <UserDetails user={user} />
      })}
      {If(editMode, {
        true: () => <EditForm onSave={handleSave} />,
        false: () => <button type="button" onClick={handleEdit}>Edit</button>
      })}
      <button type="button" onClick={handleExpand}>
        {If(isExpanded, { true: () => 'Collapse', false: () => 'Expand' })}
      </button>
    </div>
  );
}
```

---

## [WARNING] Destructure Props in Body

**Applies to**: Component function parameters

**Rule**: Destructure props in the function body, not in the parameter list.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - destructure in body
function Button(props: { onClick: () => void; children: JSX.Children }) {
  const { onClick, children } = props;
  
  return <button type="button" onClick={onClick}>{children}</button>;
}
```

**Alternative** (also acceptable):
```tsx
function Button({ onClick, children }: { onClick: () => void; children: JSX.Children }) {
  return <button type="button" onClick={onClick}>{children}</button>;
}
```

**Why**: Cleaner, more explicit, easier to extend.

---

## [WARNING] Hoist Event Handlers

**Applies to**: Event handler definitions

**Rule**: Define event handlers as named functions before JSX. Avoid inline arrow functions.

**Explicit Pattern**:
```tsx
function Form() {
  const name = Cell.source('');
  const email = Cell.source('');
  
  // ✅ CORRECT - hoisted handlers
  const handleNameChange = (event: Event) => {
    name.set((event.target as HTMLInputElement).value);
  };
  
  const handleEmailChange = (event: Event) => {
    email.set((event.target as HTMLInputElement).value);
  };
  
  const handleSubmit = () => {
    console.log('Submit:', name.get(), email.get());
  };
  
  return (
    <form>
      <input type="text" onInput={handleNameChange} />
      <input type="email" onInput={handleEmailChange} />
      <button type="button" onClick={handleSubmit}>Submit</button>
    </form>
  );
}
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - inline handlers
return (
  <form>
    <input 
      type="text" 
      onInput={(e) => name.set(e.target.value)}  {/* Inline */}
    />
    <button 
      type="button" 
      onClick={() => {  {/* Inline */
        console.log(name.get());
      }}
    >
      Submit
    </button>
  </form>
);
```

---

## [STYLE] Self-Closing Tags

**Applies to**: Void elements without children

**Rule**: Use self-closing tags for void elements (`div`, `span`, `input`, etc.) when they have no children.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - self-closing
<div class="container" />
<span id="label" />
<input type="text" />
<img src="photo.jpg" alt="Photo" />
<br />
<hr />
```

**Explicit Pattern** (with children):
```tsx
// ✅ CORRECT - closing tags with children
<div class="container">
  <p>Content here</p>
</div>
<span>Text content</span>
```

---

## [CRITICAL] Explicit Children Type

**Applies to**: Component props with children

**Rule**: Use `JSX.Children` type for components that accept children.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - explicit children type
function Card(props: { title: string; children: JSX.Children }) {
  const { title, children } = props;
  
  return (
    <div class="card">
      <h2>{title}</h2>
      <div class="content">{children}</div>
    </div>
  );
}

// Usage:
<Card title="Welcome">
  <p>This is the card content</p>
  <button>Action</button>
</Card>
```

---

## [WARNING] Button Type Attribute

**Applies to**: All `<button>` elements

**Rule**: Always specify the `type` attribute on buttons.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - explicit button types
<button type="button" onClick={handleClick}>Click me</button>
<button type="submit">Submit form</button>
<button type="reset">Reset form</button>
```

**Why**: Prevents accidental form submissions. Default is "submit" which can cause unexpected behavior.

---

## [WARNING] Use `for` Attribute (Not `htmlFor`)

**Applies to**: Label elements

**Rule**: Use `for` attribute in Retend JSX, not `htmlFor`.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - 'for' in Retend
<label for="inputId">Label Text</label>
<input id="inputId" type="text" />
```

**React Difference**:
```tsx
// React uses htmlFor
<label htmlFor="inputId">Label Text</label>
```

**Why**: Retend uses standard HTML attribute names.

---

## [CRITICAL] No `any` Type

**Applies to**: TypeScript type annotations

**Rule**: Never use `any` type. Use proper types or `unknown`.

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - any type
function process(data: any) { ... }
const value: any = getValue();
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - proper types
function process(data: UserData) { ... }
const value: unknown = getValue();

// Type guard
if (typeof value === 'string') {
  // value is string here
}
```

**Why**: `any` disables type checking. Use proper types for safety.

---

## [WARNING] Reactive Props with ValueOrCell

**Applies to**: Component props that accept Cells or static values

**Rule**: Use `ValueOrCell<T>` for props that can be static or reactive.

**Explicit Pattern**:
```tsx
import type { ValueOrCell } from 'retend';

// ✅ CORRECT - accepts static or Cell
function Label(props: { 
  text: ValueOrCell<string>;
  class?: ValueOrCell<string>;
}) {
  const { text, class: className } = props;
  
  return <span class={className}>{text}</span>;
}

// Both work:
const dynamicText = Cell.source('Hello');
<Label text="Static" />           {/* Static */}
<Label text={dynamicText} />      {/* Reactive */}
```

---

## [WARNING] Component-Scoped Listeners

**Applies to**: Using `.listen()` inside components

**Rule**: Call `.listen()` directly in the component body. Do NOT wrap it in `onSetup`.

**Why**: Retend automatically binds listeners to the component lifecycle and handles cleanup.

**Explicit Pattern**:
```tsx
function StatusIndicator() {
  const status = Cell.source('idle');
  
  // ✅ CORRECT - call directly in component body
  status.listen((newStatus) => {
    console.log('Status changed:', newStatus);
  });
  // Automatic cleanup - no manual unsubscribe needed
  
  return <div class={status}>{status}</div>;
}
```

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - don't wrap in onSetup
onSetup(() => {
  const unsubscribe = status.listen((val) => console.log(val));
  return unsubscribe;
});
```

---

## [WARNING] SVG Requires xmlns

**Applies to**: SVG elements

**Rule**: SVG elements and children must have `xmlns` attribute.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - xmlns on SVG
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect xmlns="http://www.w3.org/2000/svg" width="100" height="50" fill="red" />
  <circle xmlns="http://www.w3.org/2000/svg" cx="50" cy="50" r="40" fill="blue" />
</svg>
```

**Why**: Required for proper SVG rendering in the DOM.

---

## [WARNING] Extend Standard HTML - Don't Redefine

**Applies to**: Wrapper components (Button, Input, Card, etc.)

**Rule**: Extend `JSX.IntrinsicElements` interfaces instead of manually redefining standard attributes like `onClick`, `class`, `disabled`, etc.

**Why**:
- **Type safety**: Standard interfaces are complete and maintained
- **Reactivity**: Spread operator `{...rest}` preserves Cells for reactive props
- **Flexibility**: Consumers can use any standard HTML attribute

**Explicit Anti-Pattern**:
```tsx
// ❌ WRONG - manually redefining standard props
interface ButtonProps {
  children: JSX.Children;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit' | 'reset';     // Don't redefine!
  disabled?: boolean;                       // Don't redefine!
  onClick?: () => void;                     // Don't redefine!
  class?: string;                           // Don't redefine!
}
```

**Explicit Pattern**:
```tsx
// ✅ CORRECT - extend standard interface
type NativeButtonProps = JSX.IntrinsicElements['button'];

interface ButtonProps extends NativeButtonProps {
  variant?: 'primary' | 'secondary';  // Only add YOUR custom props
}

const Button = (props: ButtonProps) => {
  const {
    children,
    variant = 'primary',
    class: className,
    ...rest  // Captures onClick, type, disabled, aria-*, etc.
  } = props;

  return (
    <button
      class={['btn', `btn-${variant}`, className]}
      {...rest}  // Spread standard props - preserves reactivity!
    >
      {children}
    </button>
  );
};

// Usage:
<Button variant="primary" onClick={handleClick} disabled={isDisabled}>
  Click me
</Button>
```

---

## [WARNING] Fragment Shorthand

**Applies to**: Multiple root elements

**Rule**: Use `<></>` shorthand for fragments.

**Explicit Pattern**:
```tsx
// ✅ CORRECT - fragment shorthand
return (
  <>
    <div>First element</div>
    <div>Second element</div>
  </>
);
```

---

## Quick Reference: Component Checklist

Before considering a component complete, verify:

- [ ] Component name is PascalCase
- [ ] Props destructured (in body or params)
- [ ] State Cells at top (after props)
- [ ] Derived Cells next
- [ ] Handlers hoisted (not inline)
- [ ] Listeners called directly in component body (not in onSetup)
- [ ] onSetup only for non-reactive setup (NOT for .listen())
- [ ] JSX uses self-closing tags where appropriate
- [ ] Buttons have type attribute
- [ ] Labels use `for` not `htmlFor`
- [ ] No `any` types used
- [ ] Children typed as `JSX.Children`
- [ ] Wrapper components extend `JSX.IntrinsicElements` and spread `{...rest}`

---

## Quick Decision Flow

```
CREATING A COMPONENT?
├─ Name → PascalCase (MyComponent)
├─ Props → Destructure in body
├─ Children → Type as JSX.Children
├─ Reactive props → Use ValueOrCell<T>
└─ Structure → State → Derived → Handlers → Effects → JSX

NEED AN EVENT HANDLER?
├─ Define as named function in component body
└─ Reference in JSX (don't define inline)

BUILDING WRAPPER COMPONENT?
├─ Extend → `JSX.IntrinsicElements['element']`
├─ Custom props → Add only your custom properties
├─ Spread → `{...rest}` to pass standard props through
└─ Merge classes → Use array syntax: `['base', variant, rest.class]`
```

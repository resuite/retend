| title                   | impact | impactDescription                               | tags               |
| :---------------------- | :----- | :---------------------------------------------- | :----------------- |
| Valid Teleport Selector | Medium | Prevents runtime errors from invalid selectors. | teleport, web, dom |

# Valid Teleport Selector

**Context**: Using Teleport to move elements in the DOM.

**Rule**: Use either `#id` or `tagname` for static `<Teleport to>` values. The `valid-teleport-selector` lint rule enforces this for literal selectors.

**Why**:

Teleport resolves targets by ID or tag name. Keeping teleport targets simple makes the mount point predictable across client rendering, hydration, and server-rendered output.

## Examples

```tsx
// ID selector
<Teleport to="#modal-root">
  <Modal />
</Teleport>

// Tag name selector
<Teleport to="body">
  <Overlay />
</Teleport>

// HTML element ID
<Teleport to="#toast-container">
  <Toast message={message} />
</Teleport>
```

## Best Practice

Always use ID selectors for reliability:

```tsx
// In your HTML/index.html
<body>
  <div id="app"></div>
  <div id="modal-root"></div>
  <div id="toast-root"></div>
</body>;

// In your components
function App() {
  return (
    <div id="app">
      <RouterProvider router={router}>
        <Outlet />
      </RouterProvider>

      <Teleport to="#modal-root">
        <ModalOutlet />
      </Teleport>

      <Teleport to="#toast-root">
        <ToastOutlet />
      </Teleport>
    </div>
  );
}
```

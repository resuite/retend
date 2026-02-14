| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Teleport Selector Limitations | Medium | Prevents runtime errors from invalid selectors.        | teleport, web, dom          |

# Teleport Selector Limitations

**Context**: Using Teleport to move elements in the DOM.

**Rule**: Teleport only supports `#id` or `tagname` selectors. No class names or attribute selectors.

**Why**:

- Teleport has a simple, fast selector implementation
- Complex CSS selectors are not supported
- Using unsupported selectors will cause errors or unexpected behavior

## Examples

### Invalid

```tsx
// INVALID - class selector not supported
<Teleport to=".modal-container">
  <Modal />
</Teleport>

// INVALID - attribute selector not supported
<Teleport to="[data-portal]">
  <Tooltip />
</Teleport>

// INVALID - descendant selector not supported
<Teleport to="body > .container">
  <Overlay />
</Teleport>
```

### Valid

```tsx
// VALID - ID selector
<Teleport to="#modal-root">
  <Modal />
</Teleport>

// VALID - tag name selector
<Teleport to="body">
  <Overlay />
</Teleport>

// VALID - HTML element ID
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
</body>

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

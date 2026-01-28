---
name: retend-web
description: Web-specific features for Retend. Use when building web applications with Retend.
---

# Retend Web

`retend-web` provides web-specific features for Retend. It provides the glue to run Retend applications in the browser, including DOM rendering, event handling, and hydration.

## Quick Start

### 1. Setup Renderer

You must initialize the `DomRenderer` before mounting your app.

```javascript
import { setActiveRenderer } from 'retend';
import { DomRenderer } from 'retend-web';

const renderer = new DomRenderer(document.body);
setActiveRenderer(renderer);
```

**For complete setup guide →** see `references/setup.md`

### 2. Web Components

Access web-specific components like `Teleport` and `ShadowRoot`.

```jsx
import { Teleport } from 'retend-web';

<Teleport to={document.body}>
  <div class="modal">...</div>
</Teleport>;
```

**For component details →** see `references/components.md`

## Features

### Attributes & Events

Retend supports all standard HTML attributes, with added sugar for classes, styles, and event modifiers.

**For attributes guide →** see `references/attributes-and-events.md`

### Hydration

`retend-web` supports hydration of server-rendered markup.

**For hydration guide →** see `references/hydration.md`

## Bundled Resources

### References

- **setup.md** - Renderer initialization and configuration.
- **attributes-and-events.md** - Guide to classes, styles, and event handling.
- **event-modifiers.md** - Detailed reference for all event modifiers.
- **components.md** - Teleport, ShadowRoot, and other web-specific components.
- **hydration.md** - Enabling and managing hydration.

### Rules

- [class-attribute-syntax.md](rules/class-attribute-syntax.md) - No string concat or ternaries for classes.
- [component-class-merging.md](rules/component-class-merging.md) - Merge classes with props correctly.

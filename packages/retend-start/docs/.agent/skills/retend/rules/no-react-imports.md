| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| No React Imports     | High   | Prevents mixing React and Retend frameworks.           | react-migration, imports    |

# No React Imports

**Context**: Importing framework dependencies.

**Rule**: Do not import from 'react', 'react-dom', or 'react-dom/client'. Retend is a separate framework with its own APIs.

**Why**:

- Retend has no Virtual DOM
- Retend uses Cells, not useState/useEffect
- Mixing React and Retend causes conflicts and errors
- They are completely different architectural approaches

## Examples

### Invalid

```tsx
// INVALID - React imports
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect, useMemo } from 'react';

// INVALID - Using React types
import type { FC, ReactNode } from 'react';
```

### Valid

```tsx
// VALID - Retend imports
import { Cell, useSetupEffect } from 'retend';
import { render, DomRenderer } from 'retend-web';
import { Router } from 'retend/router';

// VALID - Retend types
import type { JSX } from 'retend';
```

## Complete Migration Example

**React Version:**
```tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);
  
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

**Retend Version:**
```tsx
import { Cell, useSetupEffect } from 'retend';
import { DomRenderer } from 'retend-web';

function App() {
  const count = Cell.source(0);
  
  useSetupEffect(() => {
    const unsubscribe = count.listen((newCount) => {
      document.title = `Count: ${newCount}`;
    });
    return unsubscribe;
  });
  
  return (
    <button onClick={() => count.set(count.get() + 1)}>
      Count: {count}
    </button>
  );
}

const renderer = new DomRenderer(document.body);
renderer.render(<App />);
```

## Package.json

Remove React dependencies and add Retend:

```json
{
  "dependencies": {
    "retend": "^1.0.0",
    "retend-web": "^1.0.0"
    // Remove: "react", "react-dom", @types/react, etc.
  }
}
```

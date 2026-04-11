# retend-canvas-2d

Experimental 2D canvas renderer bindings for Retend.

## Worker Context Helpers

```ts
// worker.ts
import { setupWorkerContext } from 'retend-canvas-2d/worker';

setupWorkerContext(() => <App />, {
  onInit() {
    router.navigate('/');
  },
});
```

```ts
// main.tsx
import { connectToWorkerContext } from 'retend-canvas-2d/main';

const rendererRef = connectToWorkerContext(canvas, worker);
rendererRef.resize(width, height);
```

## Development

- Install workspace deps from repo root: `pnpm install`
- Build this package: `pnpm --filter retend-canvas-2d run build`
- Rebuild on source changes: `pnpm --filter retend-canvas-2d run watch`

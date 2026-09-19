# retend-canvas-2d-tests

Browser test suite for the experimental `retend-canvas-2d` package. It lives
under `experiments/` so experimental coverage never touches the main suite.

Run from the repo root (builds `retend-canvas-2d` first):

```bash
pnpm --filter retend-canvas-2d-tests run test
```

The performance benchmark runs separately:

```bash
pnpm --filter retend-canvas-2d-tests run test:benchmark
```

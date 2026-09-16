# Retend GPUI Scaffolding & Project Creation Decisions

This document records architecture decisions for scaffolding Retend GPUI desktop applications via `retend-start`.

## Context

`retend-start` was originally authored with hardcoded web assumptions (Vite web plugins, HTML entry points, DOM mounting via `retend-web`, CSS/Tailwind, and SSG). As Retend evolves into a multi-renderer reactive framework supporting native desktop through `retend-gpui`, developers need a standardized way to scaffold new GPUI applications.

## Decisions

### 1. Unified Starter via `retend-start`
- **Decision:** Support GPUI directly in `retend-start` rather than creating a separate package (e.g. `create-retend-gpui`).
- **Rationale:** Aligns with Retend's core philosophy of decoupling reactive primitives from platform renderers. Prevents ecosystem fragmentation and eliminates duplicate scaffolding code (git initialization, formatting via `oxfmt`, linting via `oxlint`, `.vscode`/`.zed` settings, AI documentation context).

### 2. Primary Target Audience
- **Decision:** General end-users running `npx retend-start my-app` anywhere on their machine to create a native desktop app.
- **Rationale:** Tooling must produce production-grade, standalone starter projects rather than purely internal test harnesses.

### 3. Interactive Target Selection & CLI Flags
- **Decision:** Prompt every user interactively for their project target:
  - `Web (DOM + Vite)` (default)
  - `Native Desktop (GPUI)`
- **CLI Flags:** Allow bypassing prompts with `--target=web` or `--target=gpui` (or `--template=web|gpui`).

### 4. Zero-Friction Desktop Prompts
- **Decision:** When `Native Desktop (GPUI)` is chosen:
  - Skip web-only options (Tailwind CSS, Static Site Generation).
  - Auto-generate app metadata from `projectName`:
    - Application display name: derived from `projectName`
    - Application identifier: `dev.retend.<projectName>`
    - Default window: 1280x840 centered
  - Only prompt for language (or TypeScript) and optional AI docs (`.docs` and `AGENT.md`).

### 5. Graduate `retend-gpui` to `packages/`
- **Decision (Reconsidered & Adopted):** Move `retend-gpui` from `experiments/retend-gpui` to `packages/retend-gpui`. Remove `"private": true`, align its version with the monorepo release (`0.0.33`), and include it directly in root build, test, and publish pipelines.
- **Rationale:** Hard cutover to first-class package status. Cleanly eliminates the dichotomy of an "experimental yet publicly published" package, standardizes all first-party renderers under `packages/`, and integrates with the standard workspace and publish workflows.

### 6. Starter Application Template (GPUI)
- **Decision:** Mirror the Web starter with a clean native reactive counter (`App.tsx`). Features project title, welcome text, and an interactive counter button driven by `Cell.source(0)` and `onClick` over native GPUI `div` elements with flex styling.
- **Rationale:** Provides immediate conceptual consistency with the Web starter, demonstrating that Retend's fine-grained reactivity and component model behave identically across renderers.

### 7. Generator Code Organization
- **Decision:** Modularize `retend-start` with target-specific generator modules:
  - `source/generators/shared.js`: Common scaffolding (git initialization, formatting via `oxfmt`, `.vscode/`, `.zed/`, and AI documentation).
  - `source/generators/web.js`: Web-specific project scaffolding (`index.html`, DOM mounting, web router, styles).
  - `source/generators/gpui.js`: GPUI-specific project scaffolding (`application.ts`, GPUI `main.tsx`, `App.tsx`, `vite.config.ts`, and GPUI `package.json`/`tsconfig.json`).
  - `source/generation.js`: Lightweight dispatcher coordinating the shared pipeline and target generator.
- **Rationale:** Keeps generators strictly decoupled, prevents leaking DOM assumptions into native scaffolding, and establishes an extensible pattern for future renderers.

### 8. Scripts and Completion Messaging
- **Decision:** Tailor `package.json` scripts and terminal completion instructions strictly by target:
  - **GPUI Scripts:** Expose `"dev": "retend-gpui dev"`, `"typecheck": "tsc --noEmit"`, and `"lint": "oxlint ."`. Omit `"build"` until Phase 4 native application packaging is ready.
  - **GPUI Completion Message:** Guide the user to run their package manager's dev command (`pnpm run dev`, `npm run dev`) to launch the native desktop window. Remove references to `http://localhost:5229` and production build instructions.
- **Rationale:** Avoids misleading developers with non-existent web ports or placeholder build steps while native application packaging is still in development.

### 9. Dependency Resolution Strategy
- **Decision:** Always write standard registry semver strings (matching monorepo version e.g. `^0.0.33`) or `--commit` URLs via `pkg.pr.new`. Do not introduce special `--workspace` flags into `retend-start`.
- **Rationale:** Keeps `retend-start` strictly production-facing, ensuring that scaffolded packages are always clean and valid for general consumers without internal repository assumptions.

### 10. Monorepo Root Script Integration
- **Decision:** Update root `package.json` to add `build-gpui`, `publish-gpui`, include `packages/retend-gpui` in root `build` and `publish-all`, and add `'./packages/retend-gpui'` to `previews` (`pkg-pr-new`).
- **Rationale:** Fully wires `retend-gpui` into the automated monorepo CI, build, preview, and release toolchain.

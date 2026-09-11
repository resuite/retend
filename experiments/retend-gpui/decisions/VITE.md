# Retend GPUI Vite integration decisions

This document records architecture decisions for Vite-based development, hot module replacement, bundling, and production builds in `retend-gpui`. Development-time behavior described here is implemented by the current prototype; the production build sections remain planned and describe accepted target behavior that is not yet exposed.

`NATIVE.md` governs the Retend-owned native bridge and renderer/runtime behavior. This document owns the Vite development, HMR, bundling, and production integration layered on that bridge.

## HMR semantics

GPUI HMR should match the browser renderer's user-facing behavior: when a component module changes, affected component instances are remounted rather than patching their existing rendered nodes in place.

The native GPUI window and `RetendGpuiRenderer` instance remain alive. Application state outside the affected component remains alive. The affected component runs cleanup and setup again, and state created inside that component is reset. Its old native subtree may be destroyed and recreated. Transient native state within that subtree, such as focus, selection, cursor position, or uncontrolled scroll position, is not guaranteed to survive the remount.

## Development command and Vite ownership

`retend-gpui dev` is the top-level development command. It creates the Vite dev server programmatically with `createServer()`. The middleware mode, `appType: 'custom'`, and disabled WebSocket server are configured by the `retendGpui()` plugin's `config()` hook, so GPUI development does not bind an otherwise-unused HTTP port. The command fails clearly when the resolved Vite configuration does not contain the `retend-gpui` plugin.

Vite still owns the development infrastructure inside that command: configuration, plugins, transforms, file watching, module graphs, HMR calculation, and the dedicated `gpui` environment.

The Vite/dev-server process is separate from the GPUI application process. There is one GPUI application process per running application, and that application process owns every native window belonging to the application. Window creation does not create additional application processes.

Node.js is the supported development application runtime for the initial implementation. Do not add Bun or a configurable runtime abstraction yet.

## Vite/child transport

The GPUI development command launches the GPUI application runtime with Node's `child_process.fork()` and uses the built-in IPC channel for communication between the parent Vite environment and that application process.

The single fork IPC channel is multiplexed by a `channel` field on each message. Control messages on the `retend-gpui` channel cover the supervisor protocol: `init` (application module path, entry path, app name, and initial window options), `application-ready`, `application-startup-error`, and `close-application`. Vite hot-channel and module-runner payloads travel on the `vite` channel. The `IpcHotChannel` class adapts that channel to Vite's hot-channel transport interface so the environment needs no WebSocket server, TCP socket, or stdio framing protocol.

The GPUI application process hosts the Vite `ModuleRunner` for the running application, with a custom transport that sends and receives those `vite`-channel payloads over `process.send()` / `process.on('message')`.

## Process supervision

In development, `retend-gpui dev` supervises one GPUI application child process while keeping the Vite/dev-server lifecycle separate from it. The GPUI application process owns the application's complete window graph; individual windows are not separate supervised processes.

The supervisor does not preserve or reconstruct the current window graph across application-process restarts. A restart is an application restart, not a set of per-window restarts.

## Development process lifetime

When a server or configuration change requires a development-runtime restart, `retend-gpui dev` terminates the entire GPUI application process. It does not attempt to preserve the existing window graph. After the server/runtime restart completes, it launches a fresh application process and recreates only the initial window described by configuration.

If the GPUI application process crashes unexpectedly, `retend-gpui dev` treats the entire development command as failed: it does not restart the application process, and it shuts down the Vite/dev-server before exiting with a failure status.

If the user intentionally closes the final GPUI window, the application process terminates and `retend-gpui dev` exits as well. Stopping `retend-gpui dev` likewise terminates the application process rather than leaving it running independently.

## HMR implementation boundary

`retend-gpui` implements a parallel GPUI-specific HMR path, mirroring the structure of `retend-web/plugins/hmr`.

The GPUI path consumes the HMR primitives that already exist in Retend core for the browser renderer (`__HMR_SYMBOLS`, component invalidator cells, `branchState()`/`withState()`) without modifying Retend core. The browser and GPUI HMR paths share the same speculative generation model; keep them aligned when either changes.

Some behavior is therefore duplicated between web and GPUI. Any later extraction of shared HMR infrastructure should be a separate decision made after the GPUI implementation has proven itself.

## Component boundaries

In Vite development/HMR mode, every component instance should receive a stable JavaScript-only logical range around its rendered output.

These HMR boundary anchors are renderer-internal logical nodes only. They do not cross N-API and do not appear in the native GPUI tree. They allow a component to change between zero, one, or many rendered nodes while still giving HMR a precise range to replace.

On invalidation, the component function is rerun and the renderer replaces that logical range through its existing range/write machinery. Production rendering should retain the current direct component path and pay no HMR-boundary overhead.

## Vite environment

`retend-gpui` uses a dedicated Vite environment named `gpui` (a server-consumer environment with `keepProcessEnv: true`) rather than reusing Vite's `ssr` environment. The WebSocket server is disabled and per-environment start/end events are enabled during development so the supervisor can observe environment lifecycle.

The GPUI environment should own its own module graph, HMR graph, resolution behavior, and future environment-specific build configuration. GPUI is a first-class native target, not an SSR alias.

GPUI application code runs with full Node.js capabilities in both development and production. The `gpui` environment resolves Node built-ins normally and exposes the ordinary Node runtime surface, including `process`, filesystem APIs, child processes, networking, and native addons. Do not introduce a restricted capability layer for the initial runtime.

The framework packages `retend`, `retend-gpui`, and `@adbl/cells` are externalized in the `gpui` environment, excluded from `optimizeDeps`, and deduped, so applications always run against the same module instances the runtime itself loaded rather than bundled copies.

## Application instances and windows

A running GPUI application has one Node.js application process and one shared application module runtime/cache. Modules therefore evaluate once per application process rather than once per window. Shared modules are a code/runtime-sharing mechanism, not the recommended place to store mutable application or window state.

The application process owns one renderer-independent application object supplied by application code through its own explicit module path in `retendGpui()` rather than by the per-window entry module. The application object is not a Retend scope, is not backed by a renderer, and does not participate in any Retend lifecycle tree. Its default-exported class implements the GPUI application contract and has three required members: a `context` object containing application-wide shared state/resources, an `init()` method that may be synchronous or asynchronous, and a `cleanup()` method that may also be synchronous or asynchronous. The runtime constructs exactly one application instance per application runtime, awaits `init()` before rendering windows, and awaits `cleanup()` when that runtime is torn down. Shared resources such as database connections and shared Cells should live on `application.context` when they need application lifetime rather than window/component lifetime.

Each native window is otherwise an independent Retend root. Creating a window performs its own `renderToGpui`-style bootstrap with its own GPUI renderer, Retend state branch, scope tree, lifecycle tree, router/navigation state, and window-local context. No Retend scope or lifecycle state is inherited between windows, and application-wide sharing must not depend on Retend `Scope.Provider` instances spanning renderers.

The GPUI application process uses one Retend `globalData` map. Window isolation comes from each window's renderer and the state snapshots captured while rendering through that renderer, not from async-local execution contexts or per-window global maps. Before a window root is mounted, its renderer is made active; later renderer-owned callbacks restore their captured Retend state synchronously with `withState()`. Native events are dispatched through the renderer that owns the native host, and HMR boundaries retain the renderer/state of the component instance they update. GPUI must not use `AsyncLocalStorage` merely to recover window identity across asynchronous work.

Application-facing access to the current native window comes from a public `useWindow()` API backed by the window's Retend scope. It returns a stable object bound to that native window, so retaining it across asynchronous work does not lose the window identity. The object exposes readonly `width` and `height` Cells updated from Retend-owned native resize events, a writable `title` Cell that updates the native window title, an `open(options)` method, and a `close()` method for the current window. Application-wide resources are accessed through the separate public `useAppContext()` API, which returns only the configured application's `context` value rather than the application instance itself. The runtime-owned `init()` and `cleanup()` methods are therefore not reachable through the normal ambient application API.

The multi-window API is `useWindow().open(options)`. Native multi-window support is completed by the Retend-owned Phase 2 window surface so one GPUI application can own multiple independently addressable windows.

The GPUI window runtime should expose the window-local location/history/navigation behavior needed by Retend's existing router. A router associated with a GPUI window should observe that window's seeded `location`, and router navigation should update only that window's location and history. `location` is an application path rather than an HTTP/network URL.

The `window.open(options)` API is asynchronous and resolves only after the native window starts.

The resolved value is a lightweight lifecycle-only window handle. The handle is an `EventTarget` and emits a `close` event when that window terminates. It also exposes `close()`, which requests that the application close that specific window; the eventual `close` event is the lifecycle notification that the window has actually ended.

Windows form a logical opener/opened hierarchy based on which bound window object opened another window. Opened-window lifetime is coupled to the opener by default. The shared window-options shape includes an optional `closeWithOpener` boolean, defaulting to `true`; when the opener closes, the application automatically closes that window. Applications can set `closeWithOpener: false` for windows that should detach and continue running independently after their opener closes.

## Vite version

The GPUI Vite integration targets Vite 8 only. Do not add compatibility code for Vite 6 or Vite 7 environment/module-runner APIs.

## Application entrypoint and bootstrap

The GPUI application has two explicit, required modules in the Vite plugin configuration: `application`, whose default export is the process-wide application class, and `entry`, whose default export is the per-window root component. Every Vite-managed GPUI application must provide an `application` module even when its initial application context is empty; do not introduce a hidden no-op application fallback. The two contracts are separate because application lifetime and window rendering are separate concerns. The application class should implement a public `GpuiApplication<Context extends object>` interface requiring `readonly context: Context`, `init(): void | Promise<void>`, and `cleanup(): void | Promise<void>`. The application constructor is parameterless, and both lifecycle methods take no runtime arguments; the runtime contract is simply `new Application()`, and application setup imports any public GPUI APIs it needs directly rather than receiving metadata or a bootstrap/runtime facade. Requiring `Context` to be an object matches the stable-identity model: the context object exists for the lifetime of the application instance and `init()` populates or mutates it rather than replacing it. The `readonly` modifier enforces stable identity of the `context` property while still allowing the context object itself to be populated or mutated. The per-window entry module does not call `renderToGpui()` itself. Normal JavaScript module initialization remains supported, including top-level `await`.

The GPUI runtime owns application bootstrap for Vite-managed applications. It evaluates the configured `application` module, reads its default-exported application class, constructs exactly one instance for the application runtime, and awaits its `init()` method before creating any window. The runtime, not the module, owns construction so application instantiation has no required module-evaluation side effect and full reload can create a fresh instance deterministically. The application instance's `context` object must already exist immediately after construction and retain stable object identity for the lifetime of that application instance; `init()` may populate or mutate that object, but must not replace it. It then evaluates the configured `entry` module once in the shared application module runtime and reads its default-exported per-window root component. The initial window is bootstrapped as an independent Retend root with its own GPUI renderer and window execution context; later windows repeat the same per-window bootstrap while reusing the same module runtime and application instance. Application code accesses only `application.context` through `useAppContext()`. `useAppContext()` is intentionally a thin accessor: it returns the current context object without adding runtime guards for calls made before `init()` completes or after `cleanup()` begins. Normal runtime sequencing should make those calls unnecessary, and the API should not add extra lifecycle-state machinery solely to defend against them. The application lifecycle is separate from Retend component/window lifecycle and must not require a synthetic renderer or cross-window Retend state tree.

`useAppContext()` is strongly typed to the concrete `context` type of the configured application class. Because the `application` module path is configuration-dependent, the plugin generates a small declaration bridge in generated state rather than in application source. The declaration imports the configured application module type and augments the public `GpuiAppContextTypes` interface of `retend-gpui` from the instance's `context` property via `declare module 'retend-gpui'`. The bridge is regenerated in the plugin's `configResolved` hook, so it refreshes on every dev-server start and whenever Vite configuration changes. Ordinary edits to the application's `context` type do not require regeneration because TypeScript follows the imported module type. The bridge is written as an ambient type package at `node_modules/@types/retend-gpui-app/index.d.ts`, so normal TypeScript `@types` discovery loads it without requiring a committed source declaration or a `tsconfig.json` include/reference change.

Initial window configuration therefore belongs to the required `window` property of `retendGpui()` rather than the application entry module. Vite-managed applications must provide this initial window configuration explicitly. Within `window`, `width` and `height` are required. `title` is optional and defaults to `app.name`, while remaining explicitly configurable for per-window titles. Initial resizable and fullscreen/maximized state plus minimum and maximum size constraints are optional. `location` is optional and defaults to `/`. `renderToGpui()` remains available as the lower-level programmatic API for applications that are not using the Vite-managed application integration.

The configured entry module is itself an HMR boundary for the application root. A direct edit to the entrypoint remounts the root component while preserving the existing GPUI renderer and native window. Updates that propagate to the entrypoint may likewise be accepted there and remount the root.

## HMR propagation

Match the existing browser HMR behavior: JSX, TSX, and MDX application modules are unconditionally self-accepting HMR boundaries. The plugin transform injects an `import.meta.hot.accept` callback into every JSX, TSX, and MDX module outside `node_modules`, and into the configured entry module even when it is plain TypeScript. The injected callback calls the GPUI `hotReloadModule()` runtime with the old and new module namespaces. Changes to ordinary JavaScript or TypeScript dependencies propagate through Vite's module graph until they reach the nearest accepting JSX, TSX, or MDX module, which remounts its affected component exports.

The plugin's `hotUpdate` hook walks the importer chain of the changed modules before dispatching: if an update reaches the configured `application` module, it invalidates the affected modules in the environment module graph and sends a `full-reload` instead of a normal update.

If an update propagates to the configured application entrypoint without reaching an earlier accepting JSX, TSX, or MDX boundary, the entrypoint accepts the update and remounts the application root.

The configured `application` module is not an HMR boundary. Any change to it, or any dependency update that propagates into it, triggers a Vite full reload of the application runtime: preserve the native windows and their navigation state, run the old application instance's `cleanup()`, reset the application/module runtime, construct and `init()` a fresh application instance, then remount every preserved window. Do not attempt to hot-swap the application context or any part of its dependency graph in place.

Do not add special mixed-export invalidation yet. If a self-accepting JSX, TSX, or MDX module also exports non-component values, HMR ignores those exports just as the browser implementation currently does; importers may therefore retain stale values until a later full restart.

## Component export matching

GPUI HMR identifies updatable components at runtime rather than through AST heuristics or naming conventions.

When an accepting JSX, TSX, or MDX module updates, compare the old and new module exports by export key. Ignore non-function exports and function exports that were never rendered as components. Functions that have actually been rendered acquire the GPUI HMR component invalidator; those invalidators are transferred to the corresponding replacement exports and their affected component instances are remounted. The default export follows the same export-key matching rule as named exports. A rendered export whose replacement no longer exports a function under the same key is an HMR error, not a silent skip.

Router bindings participate in the same export-key matching: route registrations that point at a replaced component export are remapped to the replacement function so existing routes render the updated component without a full reload.

## HMR failure semantics

Component HMR uses speculative remount semantics. Each component boundary owns a stable base state and one committed rendering generation. When the boundary is invalidated, the replacement is rendered into a new generation while the committed generation remains mounted and running.

If the replacement render throws, dispose only the speculative generation, report the HMR error in the terminal and through the development error overlay, and leave the committed generation untouched so the last working UI and its state remain live. The next successful replacement renders and commits normally, which clears the overlay.

If the replacement render succeeds, the boundary commits: replace the committed generation's rendered nodes, dispose the old generation, promote the new generation, and activate it.

Parse, transform, or module-evaluation failures that prevent an HMR update from being applied should leave the currently running application process and UI untouched while the error is reported.

Failure of the process-wide application class's `init()` method is fatal. If `init()` rejects or throws during initial startup or while recreating the application context for a full reload, terminate the GPUI application process and shut down the Vite/dev-server as part of the failed `retend-gpui dev` command.

Failure of the application class's `cleanup()` method is not fatal to teardown itself. Report the cleanup error, but continue shutting down or performing the full reload and discard the old application instance regardless. Once cleanup has begun, the old application context must not remain active merely because one cleanup operation failed.

If the configured application entry fails to transform or evaluate before the root component has mounted, keep the application process, renderer, and native window alive. When Vite invalidates the failed module after a source fix, re-import the entry through the ModuleRunner, mount its now-valid default-exported root component, and clear the development error overlay. Initial entry recovery should not require recreating the process or window.

## Development error overlay

Development errors are reported both in the terminal and through a native Vite-style GPUI error overlay. The overlay covers transform errors, module-evaluation errors, and component-remount errors, and clears automatically after the next successful update.

The overlay is additive: it is an absolutely-positioned native node mounted as the topmost root above the live application, so the last good application subtree stays mounted and running underneath it rather than being detached or destroyed.

The overlay is owned by `retend-gpui` as a renderer-level development layer outside the application's Retend tree: the renderer creates the overlay nodes directly through its native host rather than mounting Retend components, and every live window shows it. It does not depend on application components being able to evaluate or render, so errors can still be displayed when the application tree itself is unavailable or broken. The remaining Phase 2 development-root work moves this UI into a stable runtime-owned Retend wrapper beneath the immutable native root without changing these error-reporting semantics.

## Entrypoint updates

The configured application entrypoint is the HMR boundary for the root component. When it changes during development, the runtime should evaluate the updated entry and remount the root component while keeping the existing renderer and native window alive.

## Development process exit semantics

The GPUI application process and Vite/dev-server share one development-command lifetime. Any unexpected application-process exit shuts down Vite and makes `retend-gpui dev` fail; the application is not automatically respawned. An intentional close of the final GPUI window also ends the application process and causes `retend-gpui dev` to exit, but successfully.

A Vite full reload is not the same as a Vite/dev-server restart. On a full reload, keep the existing GPUI application process and native windows alive, but dispose the current renderer-independent application context and all of its application-lifetime resources, reset the application/module runtime state, create a fresh application context, and remount the application into the existing windows. Concretely, the child process runs the old application instance's `cleanup()`, unmounts every window's renderer (clearing the rendered tree but keeping the native windows), clears the shared Retend `globalData` map, re-imports the application and entry modules through the ModuleRunner (module invalidation having already been applied server-side by the plugin's `hotUpdate` hook), constructs and `init()`s a fresh application instance, and remounts the root into each existing renderer. A full reload therefore preserves the current window graph while discarding and recreating application-level and module-level runtime state. Preserve each window's current location and history across that remount rather than resetting navigation to the location originally used when the window was created.

Changes to `vite.config.ts` or any other server/configuration condition that requires a Vite restart are full application-process restart boundaries. Reload the Vite configuration and development environment, terminate the existing GPUI application process, and then launch a fresh application process containing only the initial configured window. Do not reconstruct windows that existed before the restart. The supervisor detects these restarts through the plugin's per-environment start event: whenever the `gpui` environment listens again, the supervisor replaces the running application child with a fresh one.

## Planned production build

The current prototype deliberately rejects `vite build`; build-only options such as target and embedded Node runtime version are not part of the public plugin type until this build path exists. Canonical `app` metadata is different: it is part of the shared application definition now because development identity and eventual production packaging consume the same fields. The accepted production design is that the GPUI Vite integration should participate in `vite build` and produce a self-contained application artifact rather than only a JavaScript bundle.

The GPUI Vite plugin should bundle the application code, its JavaScript dependencies, the matching Retend GPUI native addon, and a Node.js runtime. The resulting production artifact must be runnable on a machine without a separately installed Node.js runtime.

The plugin may need custom build hooks to collect and package platform-specific native files and the matching Node.js runtime alongside the JavaScript output.

Production builds should follow Tauri's model for cross-targeting and release integration rather than promising that every host can fully build and sign every target. Build, native application bundling, and signing/notarization integration belong to the GPUI build system, but the capabilities of a particular build depend on the selected target, host platform, available toolchain, and configured credentials.

Production builds target one explicit platform/architecture at a time, such as `darwin-arm64` or `win32-x64`. Cross-target builds are allowed when matching Node.js, Retend GPUI native addon, and target toolchain artifacts are available. A cross-target build is not automatically guaranteed to support the target platform's full release-signing workflow from the current host.

The canonical target configuration lives in the GPUI Vite plugin, for example `retendGpui({ target: 'darwin-arm64' })`. Do not make an environment variable or separate CLI flag the primary configuration surface.

The `target` option is optional. When omitted, the build targets the current host platform and architecture using `${process.platform}-${process.arch}`. Cross-target builds remain explicit through the `target` option.

The embedded Node.js runtime version is configurable through the GPUI Vite plugin. If no Node version is specified, use the version of Node.js currently running the build. A pinned version can be supplied when reproducible CI or application compatibility requires it.

The production runtime should use Node's Single Executable Application (SEA) mechanism. The platform application's main executable is the selected Node runtime with the built application JavaScript embedded into it. The platform-specific Retend GPUI `.node` addon remains a real file inside the native application bundle and is loaded by the SEA at runtime.

The production JavaScript should be bundled into a single standalone SEA entry rather than emitted as a filesystem-loaded JavaScript chunk graph. Vite should inline application and JavaScript dependency code required by the entrypoint; production code splitting must not require the SEA to load ordinary JavaScript chunks from disk.

Ordinary production assets such as images, fonts, JSON/data files, and shaders should be emitted as real files in the native application bundle's resource directory rather than embedded into the SEA executable. The generated runtime should resolve Vite asset imports against that bundle resource directory. Native `.node` bindings likewise remain filesystem resources required by the executable at runtime.

Application identity and package metadata are configured explicitly through canonical app-level metadata rather than inferred from `window.title` or treated as development-only configuration. The canonical application definition lives directly in the Vite plugin configuration as `retendGpui({ app: { ... }, entry, window })`; do not introduce a separate Retend app-definition file or wrapper abstraction. The same `app` metadata is consumed by development and by eventual production packaging.

The required core fields are `app.name`, `app.identifier`, `app.version`, and `app.icon`. `app.identifier` must be a stable reverse-DNS identifier such as `com.example.myapp`. Production uses this identifier exactly as configured. Development automatically derives a distinct identifier by appending `.dev`, for example `com.example.myapp.dev`, so the development app can coexist with an installed production build without requiring a separate user-configured identifier. `app.version` must be valid SemVer, and platform-specific package versions should be derived from that canonical version rather than configured independently. `app.description` and `app.publisher` are optional.

`app.icon` is the generic cross-platform source icon. Platform-specific overrides live under their corresponding platform sections, for example `app.macos.icon` and `app.windows.icon`. The `app` configuration should include the obvious production/package metadata now, rather than introducing a narrowly development-scoped identity shape and replacing it later. In the current development host, Retend sets the child process title from `app.name`, but native application bundle/name/icon identity controls are not implemented yet; the macOS Dock may therefore still show Node's identity/icon until the native host supports configured application metadata.

## Public plugin exports

Expose the GPUI Vite integration from `retend-gpui/plugins/vite`, matching the existing `retend-web/plugins/vite` package structure.

Expose the GPUI HMR runtime from `retend-gpui/plugins/hmr`. The Vite transform should inject imports from that public module, mirroring the browser renderer's `retend-web/plugins/hmr` integration rather than using a private virtual HMR module.

Applications must explicitly register `retendGpui()` in `vite.config.ts`. `retend-gpui dev` should load that Vite configuration and fail clearly if the GPUI plugin/environment is not present rather than injecting the plugin automatically. Development and production builds should therefore share the same explicit Vite configuration.

`vite build` should emit the platform-native application bundle for the selected target, not merely an intermediate directory or JavaScript artifact. That bundle must contain the Node.js runtime, bundled application code and dependencies, and the matching Retend GPUI native addon required to run the application on the target system.

Signing and notarization should be integrated into the same build/bundling system when the required credentials and target-platform tooling are available. Local builds must not require release credentials. Release CI should prefer native runners for each target platform when that is what the platform's signing or packaging tooling requires, while still allowing supported cross-target build paths where practical.

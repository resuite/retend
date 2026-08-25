# Retend GPUI Vite integration decisions

This document records architecture decisions for Vite-based development, hot module replacement, bundling, and production builds in `retend-gpui`. It is not an implementation-status document: sections marked as planned describe accepted target behavior that is not yet exposed by the prototype.

## HMR semantics

GPUI HMR should match the browser renderer's user-facing behavior: when a component module changes, affected component instances are remounted rather than patching their existing rendered nodes in place.

The native GPUI window and `RetendGpuiRenderer` instance remain alive. Application state outside the affected component remains alive. The affected component runs cleanup and setup again, and state created inside that component is reset. Its old native subtree may be destroyed and recreated. Transient native state within that subtree, such as focus, selection, cursor position, or uncontrolled scroll position, is not guaranteed to survive the remount.

## Development command and Vite ownership

`retend-gpui dev` is the top-level development command. It creates Vite programmatically in middleware mode with `appType: 'custom'`, so GPUI development does not bind an otherwise-unused HTTP port.

Vite still owns the development infrastructure inside that command: configuration, plugins, transforms, file watching, module graphs, HMR calculation, and the dedicated `gpui` environment.

The Vite/dev-server process is separate from the GPUI application process. There is one GPUI application process per running application, and that application process owns every native window belonging to the application. Window creation does not create additional application processes.

Node.js is the supported development application runtime for the initial implementation. Do not add Bun or a configurable runtime abstraction yet.

## Vite/child transport

The GPUI development command should launch the GPUI application runtime with Node's `child_process.fork()` and use the built-in IPC channel for communication between the parent Vite environment and that application process.

The GPUI application process hosts the Vite `ModuleRunner` for the running application. HMR and module-runner messages travel through `process.send()` / `process.on('message')` rather than introducing a WebSocket server, TCP socket, or stdio framing protocol.

## Process supervision

In development, `retend-gpui dev` supervises one GPUI application child process while keeping the Vite/dev-server lifecycle separate from it. The GPUI application process owns the application's complete window graph; individual windows are not separate supervised processes.

The supervisor does not preserve or reconstruct the current window graph across application-process restarts. A restart is an application restart, not a set of per-window restarts.

## Development process lifetime

When a server or configuration change requires a development-runtime restart, `retend-gpui dev` terminates the entire GPUI application process. It does not attempt to preserve the existing window graph. After the server/runtime restart completes, it launches a fresh application process and recreates only the initial window described by configuration.

If the GPUI application process crashes unexpectedly, `retend-gpui dev` treats the entire development command as failed: it does not restart the application process, and it shuts down the Vite/dev-server before exiting with a failure status.

If the user intentionally closes the final GPUI window, the application process terminates and `retend-gpui dev` exits as well. Stopping `retend-gpui dev` likewise terminates the application process rather than leaving it running independently.

## HMR implementation boundary

For now, `retend-gpui` will implement a parallel GPUI-specific HMR path.

Do not refactor or modify the existing `retend-web` HMR implementation as part of this work. The existing browser HMR path is considered stable and hard-won. Retend core is also off limits for HMR-related changes.

Some behavior may therefore be duplicated between web and GPUI initially. Any later extraction of shared HMR infrastructure should be a separate decision made after the GPUI implementation has proven itself.

## Component boundaries

In Vite development/HMR mode, every component instance should receive a stable JavaScript-only logical range around its rendered output.

These HMR boundary anchors are renderer-internal logical nodes only. They do not cross N-API and do not appear in the native GPUI tree. They allow a component to change between zero, one, or many rendered nodes while still giving HMR a precise range to replace.

On invalidation, the component function is rerun and the renderer replaces that logical range through its existing range/write machinery. Production rendering should retain the current direct component path and pay no HMR-boundary overhead.

## Vite environment

`retend-gpui` should use a dedicated Vite environment named `gpui` rather than reusing Vite's `ssr` environment.

The GPUI environment should own its own module graph, HMR graph, resolution behavior, and future environment-specific build configuration. GPUI is a first-class native target, not an SSR alias.

GPUI application code runs with full Node.js capabilities in both development and production. The `gpui` environment should resolve Node built-ins normally and expose the ordinary Node runtime surface, including `process`, filesystem APIs, child processes, networking, and native addons. Do not introduce a restricted capability layer for the initial runtime.

## Application instances and windows

A running GPUI application has one Node.js application process and one shared application module runtime/cache. Modules therefore evaluate once per application process rather than once per window. Shared modules are a code/runtime-sharing mechanism, not the recommended place to store mutable application or window state.

The application process owns one renderer-independent application object supplied by application code through its own explicit module path in `retendGpui()` rather than by the per-window entry module. The application object is not a Retend scope, is not backed by a renderer, and does not participate in any Retend lifecycle tree. Its default-exported class implements the GPUI application contract and has three required members: a `context` object containing application-wide shared state/resources, an `init()` method that may be synchronous or asynchronous, and a `cleanup()` method that may also be synchronous or asynchronous. The runtime constructs exactly one application instance per application runtime, awaits `init()` before rendering windows, and awaits `cleanup()` when that runtime is torn down. Shared resources such as database connections and shared Cells should live on `application.context` when they need application lifetime rather than window/component lifetime.

Each native window is otherwise an independent Retend root. Creating a window performs its own `renderToGpui`-style bootstrap with its own GPUI renderer, Retend state branch, scope tree, lifecycle tree, router/navigation state, and window-local context. No Retend scope or lifecycle state is inherited between windows, and application-wide sharing must not depend on Retend `Scope.Provider` instances spanning renderers.

The GPUI application process uses one Retend `globalData` map. Window isolation comes from each window's renderer and the state snapshots captured while rendering through that renderer, not from async-local execution contexts or per-window global maps. Before a window root is mounted, its renderer is made active; later renderer-owned callbacks restore their captured Retend state synchronously with `withState()`. Native events are dispatched through the renderer that owns the native host, and HMR boundaries retain the renderer/state of the component instance they update. GPUI must not use `AsyncLocalStorage` merely to recover window identity across asynchronous work.

Application-facing access to the current native window comes from a public `useWindow()` API backed by the window's Retend scope. It returns a stable object bound to that native window, so retaining it across asynchronous work does not lose the window identity. The object exposes readonly `width` and `height` Cells populated from GPUiX's `getWindowSize()`, a writable `title` Cell that updates the native window title, an `open(options)` method, and a `close()` method for the current window. GPUiX 0.4.0 currently reports a fixed placeholder size, so live resize updates remain an upstream limitation until `getWindowSize()` is fixed. Application-wide resources are accessed through the separate public `useAppContext()` API, which returns only the configured application's `context` value rather than the application instance itself. The runtime-owned `init()` and `cleanup()` methods are therefore not reachable through the normal ambient application API.

The intended multi-window API remains `useWindow().open(options)`, but GPUiX 0.4.0 only supports one production window/application instance and rejects a second `GpuixRenderer.init()` on the same macOS thread. The current prototype therefore exercises only the initial configured window; native multi-window support is deferred until the bridge can represent one GPUI application with multiple independently addressable windows.

The GPUI window runtime should expose the window-local location/history/navigation behavior needed by Retend's existing router. A router associated with a GPUI window should observe that window's seeded `location`, and router navigation should update only that window's location and history. `location` is an application path rather than an HTTP/network URL.

The intended `window.open(options)` API is asynchronous and should resolve only after the native window starts. While GPUiX 0.4.0 remains single-window-only, development rejects `window.open()` explicitly instead of attempting a second `GpuixRenderer.init()` and crashing the application process.

The resolved value is a lightweight lifecycle-only window handle. The handle is an `EventTarget` and emits a `close` event when that window terminates. It also exposes `close()`, which requests that the application close that specific window; the eventual `close` event is the lifecycle notification that the window has actually ended.

Windows form a logical opener/opened hierarchy based on which bound window object opened another window. Opened-window lifetime is coupled to the opener by default. The shared window-options shape includes an optional `closeWithOpener` boolean, defaulting to `true`; when the opener closes, the application automatically closes that window. Applications can set `closeWithOpener: false` for windows that should detach and continue running independently after their opener closes.

## Vite version

The GPUI Vite integration targets Vite 8 only. Do not add compatibility code for Vite 6 or Vite 7 environment/module-runner APIs.

## Application entrypoint and bootstrap

The GPUI application has two explicit, required modules in the Vite plugin configuration: `application`, whose default export is the process-wide application class, and `entry`, whose default export is the per-window root component. Every Vite-managed GPUI application must provide an `application` module even when its initial application context is empty; do not introduce a hidden no-op application fallback. The two contracts are separate because application lifetime and window rendering are separate concerns. The application class should implement a public `GpuiApplication<Context extends object>` interface requiring `readonly context: Context`, `init(): void | Promise<void>`, and `cleanup(): void | Promise<void>`. The application constructor is parameterless, and both lifecycle methods take no runtime arguments; the runtime contract is simply `new Application()`, and application setup imports any public GPUI APIs it needs directly rather than receiving metadata or a bootstrap/runtime facade. Requiring `Context` to be an object matches the stable-identity model: the context object exists for the lifetime of the application instance and `init()` populates or mutates it rather than replacing it. The `readonly` modifier enforces stable identity of the `context` property while still allowing the context object itself to be populated or mutated. The per-window entry module does not call `renderToGpui()` itself. Normal JavaScript module initialization remains supported, including top-level `await`.

The GPUI runtime owns application bootstrap for Vite-managed applications. It evaluates the configured `application` module, reads its default-exported application class, constructs exactly one instance for the application runtime, and awaits its `init()` method before creating any window. The runtime, not the module, owns construction so application instantiation has no required module-evaluation side effect and full reload can create a fresh instance deterministically. The application instance's `context` object must already exist immediately after construction and retain stable object identity for the lifetime of that application instance; `init()` may populate or mutate that object, but must not replace it. It then evaluates the configured `entry` module once in the shared application module runtime and reads its default-exported per-window root component. The initial window is bootstrapped as an independent Retend root with its own GPUI renderer and window execution context; later windows repeat the same per-window bootstrap while reusing the same module runtime and application instance. Application code accesses only `application.context` through `useAppContext()`. `useAppContext()` is intentionally a thin accessor: it returns the current context object without adding runtime guards for calls made before `init()` completes or after `cleanup()` begins. Normal runtime sequencing should make those calls unnecessary, and the API should not add extra lifecycle-state machinery solely to defend against them. The application lifecycle is separate from Retend component/window lifecycle and must not require a synthetic renderer or cross-window Retend state tree.

`useAppContext()` must be strongly typed to the concrete `context` type of the configured application class. Because the `application` module path is configuration-dependent, `retend-gpui dev` should generate a small declaration bridge in generated/cache state rather than in application source. That declaration should import the configured application module type and augment the public GPUI app-context type from the instance's `context` property. Regenerate the declaration on every dev-server start and whenever Vite configuration changes, so changes to the configured `application` path are reflected automatically. Ordinary edits to the application's `context` type do not require regeneration because TypeScript follows the imported module type. Generate the bridge as an ambient type package at `node_modules/@types/retend-gpui-app/index.d.ts`, so normal TypeScript `@types` discovery loads it without requiring a committed source declaration or a `tsconfig.json` include/reference change.

Initial window configuration therefore belongs to the required `window` property of `retendGpui()` rather than the application entry module. Vite-managed applications must provide this initial window configuration explicitly. Within `window`, `width` and `height` are required. `title` is optional and defaults to `app.name`, while remaining explicitly configurable for per-window titles. Minimum and maximum size constraints are optional. `location` is optional and defaults to `/`. `renderToGpui()` remains available as the lower-level programmatic API for applications that are not using the Vite-managed application integration.

The configured entry module is itself an HMR boundary for the application root. A direct edit to the entrypoint remounts the root component while preserving the existing GPUI renderer and native window. Updates that propagate to the entrypoint may likewise be accepted there and remount the root.

## HMR propagation

Match the existing browser HMR behavior for now: JSX, TSX, and MDX application modules are unconditionally self-accepting HMR boundaries. Changes to ordinary JavaScript or TypeScript dependencies propagate through Vite's module graph until they reach the nearest accepting JSX, TSX, or MDX module, which remounts its affected component exports.

If an update propagates to the configured application entrypoint without reaching an earlier accepting JSX, TSX, or MDX boundary, the entrypoint accepts the update and remounts the application root.

The configured `application` module is not an HMR boundary. Any change to it, or any dependency update that propagates into it, triggers a Vite full reload of the application runtime: preserve the native windows and their navigation state, run the old application instance's `cleanup()`, reset the application/module runtime, construct and `init()` a fresh application instance, then remount every preserved window. Do not attempt to hot-swap the application context or any part of its dependency graph in place.

Do not add special mixed-export invalidation yet. If a self-accepting JSX, TSX, or MDX module also exports non-component values, HMR ignores those exports just as the browser implementation currently does; importers may therefore retain stale values until a later full restart.

## Component export matching

GPUI HMR should identify updatable components at runtime rather than through AST heuristics or naming conventions.

When an accepting JSX, TSX, or MDX module updates, compare the old and new module exports by export key. Ignore non-function exports and function exports that were never rendered as components. Functions that have actually been rendered acquire the GPUI HMR component invalidator; those invalidators are transferred to the corresponding replacement exports and their affected component instances are remounted. The default export follows the same export-key matching rule as named exports.

## HMR failure semantics

Component HMR uses eager remount semantics. When a component boundary is invalidated, dispose the old component state before attempting to render the replacement.

If the replacement render throws, report the HMR error and leave the failed boundary in that errored state. Do not attempt transactional rollback to the old subtree, and do not restart the entire GPUI application process solely because a component remount failed.

Parse, transform, or module-evaluation failures that prevent an HMR update from being applied should leave the currently running application process and UI untouched while the error is reported.

Failure of the process-wide application class's `init()` method is fatal. If `init()` rejects or throws during initial startup or while recreating the application context for a full reload, terminate the GPUI application process and shut down the Vite/dev-server as part of the failed `retend-gpui dev` command.

Failure of the application class's `cleanup()` method is not fatal to teardown itself. Report the cleanup error, but continue shutting down or performing the full reload and discard the old application instance regardless. Once cleanup has begun, the old application context must not remain active merely because one cleanup operation failed.

If the configured application entry fails to transform or evaluate before the root component has mounted, keep the application process, renderer, and native window alive. When Vite invalidates the failed module after a source fix, re-import the entry through the ModuleRunner, mount its now-valid default-exported root component, and clear the development error overlay. Initial entry recovery should not require recreating the process or window.

## Development error overlay

Development errors should be reported both in the terminal and through a native Vite-style GPUI error overlay. The overlay should cover transform errors, module-evaluation errors, and component-remount errors, and should clear automatically after the next successful update.

The overlay is owned by `retend-gpui` as a renderer-level development layer outside the application's Retend tree. It must not depend on application components being able to evaluate or render, so errors can still be displayed when the application tree itself is unavailable or broken.

## Entrypoint updates

The configured application entrypoint is the HMR boundary for the root component. When it changes during development, the runtime should evaluate the updated entry and remount the root component while keeping the existing renderer and native window alive.

## Development process exit semantics

The GPUI application process and Vite/dev-server share one development-command lifetime. Any unexpected application-process exit shuts down Vite and makes `retend-gpui dev` fail; the application is not automatically respawned. An intentional close of the final GPUI window also ends the application process and causes `retend-gpui dev` to exit, but successfully.

A Vite full reload is not the same as a Vite/dev-server restart. On a full reload, keep the existing GPUI application process and native windows alive, but dispose the current renderer-independent application context and all of its application-lifetime resources, reset the application/module runtime state, create a fresh application context, and remount the application into the existing windows. A full reload therefore preserves the current window graph while discarding and recreating application-level and module-level runtime state. Preserve each window's current location and history across that remount rather than resetting navigation to the location originally used when the window was created.

Changes to `vite.config.ts` or any other server/configuration condition that requires a Vite restart are full application-process restart boundaries. Reload the Vite configuration and development environment, terminate the existing GPUI application process, and then launch a fresh application process containing only the initial configured window. Do not reconstruct windows that existed before the restart.

## Planned production build

The current prototype deliberately rejects `vite build`; build-only options such as target and embedded Node runtime version are not part of the public plugin type until this build path exists. Canonical `app` metadata is different: it is part of the shared application definition now because development identity and eventual production packaging consume the same fields. The accepted production design is that the GPUI Vite integration should participate in `vite build` and produce a self-contained application artifact rather than only a JavaScript bundle.

The GPUI Vite plugin should bundle the application code, its JavaScript dependencies, required native runtime assets such as the GPUiX native binding, and a Node.js runtime. The resulting production artifact must be runnable on a machine without a separately installed Node.js runtime.

The plugin may need custom build hooks to collect and package platform-specific native files and the matching Node.js runtime alongside the JavaScript output.

Production builds should follow Tauri's model for cross-targeting and release integration rather than promising that every host can fully build and sign every target. Build, native application bundling, and signing/notarization integration belong to the GPUI build system, but the capabilities of a particular build depend on the selected target, host platform, available toolchain, and configured credentials.

Production builds target one explicit platform/architecture at a time, such as `darwin-arm64` or `win32-x64`. Cross-target builds are allowed when matching Node.js, GPUiX, and target toolchain artifacts are available. A cross-target build is not automatically guaranteed to support the target platform's full release-signing workflow from the current host.

The canonical target configuration lives in the GPUI Vite plugin, for example `retendGpui({ target: 'darwin-arm64' })`. Do not make an environment variable or separate CLI flag the primary configuration surface.

The `target` option is optional. When omitted, the build targets the current host platform and architecture using `${process.platform}-${process.arch}`. Cross-target builds remain explicit through the `target` option.

The embedded Node.js runtime version is configurable through the GPUI Vite plugin. If no Node version is specified, use the version of Node.js currently running the build. A pinned version can be supplied when reproducible CI or application compatibility requires it.

The production runtime should use Node's Single Executable Application (SEA) mechanism. The platform application's main executable is the selected Node runtime with the built application JavaScript embedded into it. Platform-specific native assets such as the GPUiX `.node` binding remain real files inside the native application bundle and are loaded by the SEA at runtime.

The production JavaScript should be bundled into a single standalone SEA entry rather than emitted as a filesystem-loaded JavaScript chunk graph. Vite should inline application and JavaScript dependency code required by the entrypoint; production code splitting must not require the SEA to load ordinary JavaScript chunks from disk.

Ordinary production assets such as images, fonts, JSON/data files, and shaders should be emitted as real files in the native application bundle's resource directory rather than embedded into the SEA executable. The generated runtime should resolve Vite asset imports against that bundle resource directory. Native `.node` bindings likewise remain filesystem resources required by the executable at runtime.

Application identity and package metadata are configured explicitly through canonical app-level metadata rather than inferred from `window.title` or treated as development-only configuration. The canonical application definition lives directly in the Vite plugin configuration as `retendGpui({ app: { ... }, entry, window })`; do not introduce a separate Retend app-definition file or wrapper abstraction. The same `app` metadata is consumed by development and by eventual production packaging.

The required core fields are `app.name`, `app.identifier`, `app.version`, and `app.icon`. `app.identifier` must be a stable reverse-DNS identifier such as `com.example.myapp`. Production uses this identifier exactly as configured. Development automatically derives a distinct identifier by appending `.dev`, for example `com.example.myapp.dev`, so the development app can coexist with an installed production build without requiring a separate user-configured identifier. `app.version` must be valid SemVer, and platform-specific package versions should be derived from that canonical version rather than configured independently. `app.description` and `app.publisher` are optional.

`app.icon` is the generic cross-platform source icon. Platform-specific overrides live under their corresponding platform sections, for example `app.macos.icon` and `app.windows.icon`. The `app` configuration should include the obvious production/package metadata now, rather than introducing a narrowly development-scoped identity shape and replacing it later. In the current GPUiX 0.4.0 development host, Retend can set the child process title from `app.name`, but GPUiX does not expose native application bundle/name/icon identity controls; the macOS Dock may therefore still show Node's identity/icon until the native host supports configured application metadata.

## Public plugin exports

Expose the GPUI Vite integration from `retend-gpui/plugins/vite`, matching the existing `retend-web/plugins/vite` package structure.

Expose the GPUI HMR runtime from `retend-gpui/plugins/hmr`. The Vite transform should inject imports from that public module, mirroring the browser renderer's `retend-web/plugins/hmr` integration rather than using a private virtual HMR module.

Applications must explicitly register `retendGpui()` in `vite.config.ts`. `retend-gpui dev` should load that Vite configuration and fail clearly if the GPUI plugin/environment is not present rather than injecting the plugin automatically. Development and production builds should therefore share the same explicit Vite configuration.

`vite build` should emit the platform-native application bundle for the selected target, not merely an intermediate directory or JavaScript artifact. That bundle must contain the Node.js runtime, bundled application code and dependencies, and the matching GPUiX native assets required to run the application on the target system.

Signing and notarization should be integrated into the same build/bundling system when the required credentials and target-platform tooling are available. Local builds must not require release credentials. Release CI should prefer native runners for each target platform when that is what the platform's signing or packaging tooling requires, while still allowing supported cross-target build paths where practical.

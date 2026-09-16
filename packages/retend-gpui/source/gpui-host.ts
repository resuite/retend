import type {
  NativeEventPayload,
  NativeRendererBinding,
  NativeTransportPayload,
} from './native/addon.js';
import type {
  ElementKind as ElementKindValue,
  NativeEventId as NativeEventIdValue,
  PropertyId as PropertyIdValue,
  StyleState as StyleStateValue,
} from './native/protocol.generated.js';
import type { ProtocolPropertyValue } from './native/protocol.js';
import type {
  GpuiMeasurement,
  GpuiScrollOffset,
  GpuiSelection,
} from './types.js';

import {
  loadNativeAddon,
  NativeRendererFatalError,
  parseNativeBridgeFailure,
} from './native/addon.js';
import { allocateNativeNodeId } from './native/node-id.js';
import { CommandBatchWriter } from './native/protocol.js';
import { nativeRuntime } from './native/runtime.js';
import { validateGpuiWindowOptions, type GpuiWindowOptions } from './window.js';

const LOCATION_BASE = 'retend://app/';

interface GpuiNavigationEntry {
  url: URL;
  state: unknown;
}

class GpuiNavigation {
  readonly #target: EventTarget;
  #entries: GpuiNavigationEntry[] = [
    { url: new URL('/', LOCATION_BASE), state: null },
  ];
  #index = 0;

  constructor(target: EventTarget) {
    this.#target = target;
  }

  get #current(): GpuiNavigationEntry {
    return this.#entries[this.#index];
  }

  get pathname(): string {
    return this.#current.url.pathname;
  }

  get search(): string {
    return this.#current.url.search;
  }

  get hash(): string {
    return this.#current.url.hash;
  }

  get href(): string {
    return `${this.pathname}${this.search}${this.hash}`;
  }

  get length(): number {
    return this.#entries.length;
  }

  get state(): unknown {
    return this.#current.state;
  }

  reset(path: string): void {
    this.#entries = [{ url: this.#resolve(path), state: null }];
    this.#index = 0;
  }

  pushState(state: unknown, _unused: string, path?: string | URL | null): void {
    this.#entries.splice(this.#index + 1);
    this.#entries.push({ url: this.#resolve(path), state });
    this.#index = this.#entries.length - 1;
  }

  replaceState(
    state: unknown,
    _unused: string,
    path?: string | URL | null
  ): void {
    this.#entries[this.#index] = { url: this.#resolve(path), state };
  }

  go(delta = 0): void {
    const offset = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    if (offset === 0) return;

    const nextIndex = this.#index + offset;
    if (nextIndex < 0 || nextIndex >= this.#entries.length) return;

    this.#index = nextIndex;
    this.#target.dispatchEvent(new Event('popstate'));
  }

  back(): void {
    this.go(-1);
  }

  forward(): void {
    this.go(1);
  }

  #resolve(path?: string | URL | null): URL {
    return path === undefined || path === null
      ? new URL(this.#current.url)
      : new URL(String(path), this.#current.url);
  }
}

export interface GpuiHostOptions {
  /** Creates the retained native tree without opening an OS window. */
  headless?: boolean;
  /** @internal Receives structured native events for this window. */
  onNativeEvent?: (event: NativeEventPayload) => void;
}

/**
 * Window-local Retend host backed directly by the Retend-owned native command
 * protocol. Navigation remains JavaScript-owned.
 */
export class GpuiHost extends EventTarget {
  readonly #headless: boolean;
  readonly #onNativeEvent?: (event: NativeEventPayload) => void;
  #writer = new CommandBatchWriter();
  readonly #navigation = new GpuiNavigation(this);
  #binding: NativeRendererBinding | null = null;
  #rootId = 0;
  #flushScheduled = false;
  #flushing = false;
  #nativeAcquired = false;

  readonly location = this.#navigation;
  readonly history = this.#navigation;

  constructor(options: GpuiHostOptions = {}) {
    super();
    this.#headless = options.headless ?? false;
    this.#onNativeEvent = options.onNativeEvent;
  }

  get isInitialized(): boolean {
    return this.#binding !== null;
  }

  get rootId(): number {
    this.#requireBinding();
    return this.#rootId;
  }

  init(options: GpuiWindowOptions = {}): void {
    if (this.#binding)
      throw new Error('Retend GPUI host is already initialized.');
    validateGpuiWindowOptions(options);

    this.#rootId = allocateNativeNodeId();
    this.#writer = new CommandBatchWriter();
    this.#flushScheduled = false;
    this.#flushing = false;
    this.#binding = new (loadNativeAddon().NativeRendererBinding)(
      this.#rootId,
      this.#headless,
      options,
      (payload) => this.#handleNativeEvent(payload)
    );
    if (options.location !== undefined)
      this.#navigation.reset(options.location);
  }

  setWindowTitle(title: string): void {
    this.#requireBinding().setWindowTitle(title);
  }

  /** @internal Reports a recoverable application error to this window runtime. */
  reportApplicationError(error: unknown): void {
    this.dispatchEvent(
      new CustomEvent('applicationerror', { detail: error, cancelable: false })
    );
  }

  resetLocation(path: string): void {
    this.history.reset(path);
  }

  createNode(kind: ElementKindValue): number {
    this.#requireBinding();
    const id = allocateNativeNodeId();
    this.#writer.createNode(id, kind);
    this.#requestFlush();
    return id;
  }

  createText(text: string): number {
    this.#requireBinding();
    const id = allocateNativeNodeId();
    this.#writer.createText(id, text);
    this.#requestFlush();
    return id;
  }

  updateText(id: number, text: string): void {
    this.#requireBinding();
    this.#writer.updateText(id, text);
    this.#requestFlush();
  }

  setProperty(
    id: number,
    property: PropertyIdValue,
    value: ProtocolPropertyValue
  ): void {
    this.#requireBinding();
    this.#writer.setProperty(id, property, value);
    this.#requestFlush();
  }

  setStyle(
    id: number,
    properties: readonly (readonly [PropertyIdValue, ProtocolPropertyValue])[]
  ): void {
    this.#requireBinding();
    this.#writer.setStyle(id, properties);
    this.#requestFlush();
  }

  setPseudoStyle(
    id: number,
    state: StyleStateValue,
    properties: readonly (readonly [PropertyIdValue, ProtocolPropertyValue])[]
  ): void {
    this.#requireBinding();
    this.#writer.setPseudoStyle(id, state, properties);
    this.#requestFlush();
  }

  insertChild(parentId: number, childId: number, beforeId = 0): void {
    this.#requireBinding();
    this.#writer.insertChild(parentId, childId, beforeId);
    this.#requestFlush();
  }

  removeChild(parentId: number, childId: number): void {
    this.#requireBinding();
    this.#writer.removeChild(parentId, childId);
    this.#requestFlush();
  }

  subscribeEvent(id: number, event: NativeEventIdValue): void {
    this.#requireBinding();
    this.#writer.subscribeEvent(id, event);
    this.#requestFlush();
  }

  unsubscribeEvent(id: number, event: NativeEventIdValue): void {
    this.#requireBinding();
    this.#writer.unsubscribeEvent(id, event);
    this.#requestFlush();
  }

  flush(): void {
    const binding = this.#requireBinding();
    if (this.#flushing || this.#writer.isEmpty) return;
    this.#flushing = true;
    try {
      binding.applyCommandBatch(this.#writer.finish());
    } catch (error) {
      this.#fail(error);
    } finally {
      this.#flushing = false;
      if (!this.#writer.isEmpty) this.#requestFlush();
    }
  }

  settle(): void {
    this.#flushBinding().settle();
  }

  focusNode(id: number): void {
    this.#flushBinding().focusNode(id);
  }

  blurNode(id: number): void {
    this.#flushBinding().blurNode(id);
  }

  setSelectionRangeNode(id: number, start: number, end: number): void {
    this.#flushBinding().setSelectionRangeNode(id, start, end);
  }

  selectNode(id: number): void {
    this.#flushBinding().selectNode(id);
  }

  async getSelectionNode(id: number): Promise<GpuiSelection> {
    return this.#query((binding) => binding.getSelectionNode(id));
  }

  scrollToNode(id: number, x: number, y: number): void {
    this.#flushBinding().scrollToNode(id, x, y);
  }

  scrollByNode(id: number, x: number, y: number): void {
    this.#flushBinding().scrollByNode(id, x, y);
  }

  scrollIntoViewNode(id: number): void {
    this.#flushBinding().scrollIntoViewNode(id);
  }

  async getScrollOffsetNode(id: number): Promise<GpuiScrollOffset> {
    return this.#query((binding) => binding.getScrollOffsetNode(id));
  }

  async measureNode(id: number): Promise<GpuiMeasurement> {
    return this.#query((binding) => binding.measureNode(id));
  }

  /** @internal Discards queued commands that belong to an abandoned JS root. */
  discardPendingCommands(): void {
    this.#writer = new CommandBatchWriter();
  }

  close(): void {
    const binding = this.#binding;
    if (!binding) return;
    this.#binding = null;
    this.#releaseNativeRuntime();
    binding.close();
  }

  /** @internal Whether a native node is currently attached under this window root. */
  isNodePresented(id: number): boolean {
    return this.#requireBinding().isNodePresented(id);
  }

  /** @internal Test/diagnostic retained-tree snapshot. */
  debugTree(): unknown {
    return JSON.parse(this.#requireBinding().debugTreeJson());
  }

  #requestFlush(): void {
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      if (!this.#binding || this.#writer.isEmpty) return;
      try {
        this.flush();
      } catch (error) {
        if (this.#binding && !(error instanceof NativeRendererFatalError))
          throw error;
      }
    });
  }

  #flushBinding(): NativeRendererBinding {
    this.flush();
    return this.#requireBinding();
  }

  #query<T>(
    execute: (binding: NativeRendererBinding) => Promise<T>
  ): Promise<T> {
    return execute(this.#flushBinding()).catch((error: unknown) =>
      this.#nativeQueryError(error)
    );
  }

  #requireBinding(): NativeRendererBinding {
    if (!this.#binding) {
      throw new Error(
        'RetendGpuiRenderer.init() must be called before native work.'
      );
    }
    return this.#binding;
  }

  #handleNativeClose(): void {
    if (!this.#binding) return;
    this.#binding = null;
    this.#releaseNativeRuntime();
    this.dispatchEvent(new Event('close'));
  }

  /** @internal Starts the native event pump once the OS window has opened. */
  #acquireNativeRuntime(): void {
    if (this.#nativeAcquired || this.#headless) return;
    nativeRuntime.acquire();
    this.#nativeAcquired = true;
  }

  #releaseNativeRuntime(): void {
    if (!this.#nativeAcquired) return;
    this.#nativeAcquired = false;
    nativeRuntime.release();
  }

  #handleNativeEvent(payload: NativeTransportPayload): void {
    if (payload.event) {
      this.#onNativeEvent?.(payload.event);
      return;
    }
    const event = payload.window;
    this.#acquireNativeRuntime();
    switch (event.kind) {
      case 'close':
        this.#handleNativeClose();
        return;
      case 'resize':
        this.dispatchEvent(
          new CustomEvent('resize', {
            detail: { width: event.width, height: event.height },
          })
        );
        this.flush();
        return;
      case 'focus':
      case 'blur':
      case 'reload':
        this.dispatchEvent(new Event(event.kind));
        return;
      default:
        throw new Error(
          `Unknown native window event: ${String(Reflect.get(event as object, 'kind'))}`
        );
    }
  }

  #nativeQueryError(cause: unknown): never {
    const failure = parseNativeBridgeFailure(cause);
    if (!failure) throw cause;
    if (failure.code === 'CLOSED_WINDOW') this.#handleNativeClose();
    if (failure.code === 'POISONED_RENDERER') {
      throw new NativeRendererFatalError(
        `Retend GPUI native query failed: ${failure.message}`,
        failure
      );
    }
    const error = new Error(
      `Retend GPUI native query failed: ${failure.message}`
    );
    error.name = 'NativeNodeQueryError';
    Object.defineProperty(error, 'code', { value: failure.code });
    throw error;
  }

  #fail(error: unknown): never {
    const nativeFailure = parseNativeBridgeFailure(error) ?? {
      code: 'NATIVE_BRIDGE_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };

    if (nativeFailure.code === 'CLOSED_WINDOW') {
      this.#handleNativeClose();
      throw error;
    }

    if (nativeFailure.code !== 'POISONED_RENDERER') {
      const javascriptStack =
        new Error('Retend GPUI command-batch submission failed here.').stack ??
        'JavaScript stack unavailable.';
      try {
        this.#requireBinding().reportFatal(javascriptStack);
      } catch {
        // The original native failure remains the primary diagnostic.
      }
      this.dispatchEvent(new Event('fatal'));
      this.#writer = new CommandBatchWriter();
    }

    throw new NativeRendererFatalError(
      `Retend GPUI rejected a native command batch: ${nativeFailure.message}`,
      nativeFailure,
      { cause: error }
    );
  }
}

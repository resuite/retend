import type {
  NativeBridgeFailure,
  NativeRendererBinding,
} from './native/addon.js';
import type {
  ElementKind as ElementKindValue,
  PropertyId as PropertyIdValue,
} from './native/protocol.generated.js';
import type { ProtocolPropertyValue } from './native/protocol.js';
import type { GpuiWindowOptions } from './window.js';

import {
  loadNativeAddon,
  NativeRendererFatalError,
  parseNativeBridgeFailure,
} from './native/addon.js';
import { allocateNativeNodeId } from './native/node-id.js';
import { CommandBatchWriter } from './native/protocol.js';
import {
  acquireNativeRuntime,
  releaseNativeRuntime,
} from './native/runtime.js';

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
}

/**
 * Window-local Retend host backed directly by the Retend-owned native command
 * protocol. Navigation remains JavaScript-owned.
 */
export class GpuiHost extends EventTarget {
  readonly #headless: boolean;
  #writer = new CommandBatchWriter();
  readonly #navigation = new GpuiNavigation(this);
  #binding: NativeRendererBinding | null = null;
  #rootId = 0;
  #flushScheduled = false;
  #flushing = false;
  #fatalFailure: NativeBridgeFailure | undefined;
  #closed = false;

  readonly location = this.#navigation;
  readonly history = this.#navigation;
  readonly document = { title: '' };

  constructor(options: GpuiHostOptions = {}) {
    super();
    this.#headless = options.headless ?? false;
  }

  get isInitialized(): boolean {
    return this.#binding !== null;
  }

  get rootId(): number {
    this.#requireBinding();
    return this.#rootId;
  }

  get poisoned(): boolean {
    return this.#fatalFailure !== undefined;
  }

  get nativeClosed(): boolean {
    return this.#binding !== null && (this.#closed || this.#binding.isClosed());
  }

  init(options: GpuiWindowOptions = {}): void {
    if (this.#binding)
      throw new Error('Retend GPUI host is already initialized.');
    for (const [name, value] of [
      ['width', options.width],
      ['height', options.height],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new TypeError(
          `Native window ${name} must be a finite positive number.`
        );
      }
    }

    this.document.title = options.title ?? '';
    this.#rootId = allocateNativeNodeId();
    this.#writer = new CommandBatchWriter();
    this.#flushScheduled = false;
    this.#flushing = false;
    this.#closed = false;
    this.#fatalFailure = undefined;
    this.#binding = new (loadNativeAddon().NativeRendererBinding)(
      this.#rootId,
      this.#headless,
      {
        title: options.title,
        width: options.width,
        height: options.height,
      }
    );
    if (!this.#headless) {
      acquireNativeRuntime(this.#binding, () => this.#handleNativeClose(false));
    }
  }

  setWindowTitle(title: string): void {
    this.#assertUsable().setWindowTitle(title);
    this.document.title = title;
  }

  resetLocation(path: string): void {
    this.history.reset(path);
  }

  createNode(kind: ElementKindValue): number {
    this.#assertUsable();
    const id = allocateNativeNodeId();
    this.#writer.createNode(id, kind);
    this.#requestFlush();
    return id;
  }

  createText(text: string): number {
    this.#assertUsable();
    const id = allocateNativeNodeId();
    this.#writer.createText(id, text);
    this.#requestFlush();
    return id;
  }

  updateText(id: number, text: string): void {
    this.#assertUsable();
    this.#writer.updateText(id, text);
    this.#requestFlush();
  }

  setProperty(
    id: number,
    property: PropertyIdValue,
    value: ProtocolPropertyValue
  ): void {
    this.#assertUsable();
    this.#writer.setProperty(id, property, value);
    this.#requestFlush();
  }

  setStyle(
    id: number,
    properties: readonly (readonly [PropertyIdValue, ProtocolPropertyValue])[]
  ): void {
    this.#assertUsable();
    this.#writer.setStyle(id, properties);
    this.#requestFlush();
  }

  insertChild(parentId: number, childId: number, beforeId = 0): void {
    this.#assertUsable();
    this.#writer.insertChild(parentId, childId, beforeId);
    this.#requestFlush();
  }

  removeChild(parentId: number, childId: number): void {
    this.#assertUsable();
    this.#writer.removeChild(parentId, childId);
    this.#requestFlush();
  }

  flush(): void {
    const binding = this.#assertUsable();
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
    this.flush();
    this.#requireBinding().settle();
  }

  close(): void {
    const binding = this.#binding;
    if (!binding) return;
    try {
      if (this.#closed || binding.isClosed()) {
        this.#handleNativeClose(true);
        return;
      }
      try {
        if (!this.poisoned) this.flush();
      } finally {
        this.#closed = true;
        try {
          binding.close();
        } finally {
          if (!this.#headless) releaseNativeRuntime(binding);
        }
      }
    } finally {
      this.#binding = null;
    }
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
      if (!this.poisoned && !this.#closed) this.flush();
    });
  }

  #requireBinding(): NativeRendererBinding {
    if (!this.#binding) {
      throw new Error(
        'RetendGpuiRenderer.init() must be called before native work.'
      );
    }
    return this.#binding;
  }

  #assertUsable(): NativeRendererBinding {
    const binding = this.#requireBinding();
    if (this.#closed || binding.isClosed()) {
      if (!this.#closed) this.#handleNativeClose(true);
      throw new Error(
        'A closed Retend GPUI renderer cannot accept native work.'
      );
    }
    if (this.poisoned) {
      throw new NativeRendererFatalError(
        'This Retend GPUI renderer is permanently poisoned after a native bridge failure.',
        this.#fatalFailure
      );
    }
    return binding;
  }

  #handleNativeClose(releaseRuntime: boolean): void {
    if (this.#closed) return;
    this.#closed = true;
    if (releaseRuntime && !this.#headless && this.#binding) {
      releaseNativeRuntime(this.#binding);
    }
    this.dispatchEvent(new Event('close'));
  }

  #fail(error: unknown): never {
    const nativeFailure = parseNativeBridgeFailure(error) ?? {
      code: 'NATIVE_BRIDGE_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
    const javascriptStack =
      new Error('Retend GPUI command-batch submission failed here.').stack ??
      'JavaScript stack unavailable.';
    this.#fatalFailure = nativeFailure;
    try {
      this.#requireBinding().reportFatal(javascriptStack);
    } catch {
      // The original native failure remains the primary diagnostic.
    }
    throw new NativeRendererFatalError(
      `Retend GPUI rejected a native command batch: ${nativeFailure.message}`,
      nativeFailure,
      { cause: error }
    );
  }
}

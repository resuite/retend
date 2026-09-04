import type {
  NativeBridgeFailure,
  NativeRendererBinding,
  NativeWindowOptions,
} from './addon.js';
import type {
  ElementKind as ElementKindValue,
  PropertyId as PropertyIdValue,
} from './protocol.generated.js';

import { loadNativeAddon, parseNativeBridgeFailure } from './addon.js';
import { allocateNativeNodeId } from './node-id.js';
import {
  ElementKind,
  type ProtocolPropertyValue,
  PropertyId,
  CommandBatchWriter,
} from './protocol.js';
import { acquireNativeRuntime, releaseNativeRuntime } from './runtime.js';

interface NativeCommandHostOptions {
  headless?: boolean;
  window?: NativeWindowOptions;
  onClose?: () => void;
}

export class NativeRendererFatalError extends Error {
  constructor(
    message: string,
    readonly nativeFailure?: NativeBridgeFailure,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NativeRendererFatalError';
  }
}

/** @internal Host for the Retend-owned binary native bridge. */
export class NativeCommandHost {
  readonly rootId: number;
  readonly #binding: NativeRendererBinding;
  readonly #writer = new CommandBatchWriter();
  #flushScheduled = false;
  #flushing = false;
  #fatalFailure: NativeBridgeFailure | undefined;
  #closed = false;
  readonly #headless: boolean;
  readonly #onClose?: () => void;

  constructor(options: NativeCommandHostOptions = {}) {
    this.#headless = options.headless ?? true;
    this.#onClose = options.onClose;
    this.rootId = allocateNativeNodeId();
    this.#binding = new (loadNativeAddon().NativeRendererBinding)(
      this.rootId,
      this.#headless,
      options.window
    );
    if (!this.#headless) {
      acquireNativeRuntime(this.#binding, () => this.#handleNativeClose(false));
    }
  }

  get windowId(): number {
    return this.#binding.windowId;
  }

  get poisoned(): boolean {
    return this.#fatalFailure !== undefined;
  }

  get closed(): boolean {
    return this.#closed || this.#binding.isClosed();
  }

  createNode(kind: ElementKindValue = ElementKind.Container): number {
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

  setWindowTitle(title: string): void {
    this.#assertUsable();
    this.#binding.setWindowTitle(title);
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

  #requestFlush(): void {
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      if (!this.poisoned && !this.#closed) this.flush();
    });
  }

  flush(): void {
    this.#assertUsable();
    if (this.#flushing || this.#writer.isEmpty) return;
    this.#flushing = true;
    try {
      this.#binding.applyCommandBatch(this.#writer.finish());
    } catch (error) {
      this.#fail(error);
    } finally {
      this.#flushing = false;
      if (!this.#writer.isEmpty) this.#requestFlush();
    }
  }

  settle(): void {
    this.flush();
    this.#binding.settle();
  }

  close(): void {
    if (this.#closed) return;
    if (this.#binding.isClosed()) {
      this.#handleNativeClose(true);
      return;
    }
    try {
      if (!this.poisoned) this.flush();
    } finally {
      this.#closed = true;
      try {
        this.#binding.close();
      } finally {
        if (!this.#headless) releaseNativeRuntime(this.#binding);
      }
    }
  }

  /** @internal Test/diagnostic view; not part of the public renderer API. */
  debugTree(): unknown {
    return JSON.parse(this.#binding.debugTreeJson());
  }

  #assertUsable(): void {
    if (this.#closed || this.#binding.isClosed()) {
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
  }

  #handleNativeClose(releaseRuntime: boolean): void {
    if (this.#closed) return;
    this.#closed = true;
    if (releaseRuntime && !this.#headless) releaseNativeRuntime(this.#binding);
    this.#onClose?.();
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
      this.#binding.reportFatal(javascriptStack);
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

export { ElementKind, PropertyId };

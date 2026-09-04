import type {
  ElementKind as ElementKindValue,
  PropertyId as PropertyIdValue,
} from './native/protocol.generated.js';
import type { ProtocolPropertyValue } from './native/protocol.js';
import type { GpuiWindowOptions } from './window.js';

import { NativeCommandHost } from './native/host.js';

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
 * Window-local JavaScript host plus the Retend-owned native command bridge.
 * Navigation remains JavaScript-owned; rendering mutations go only through
 * {@link NativeCommandHost}.
 */
export class GpuiHost extends EventTarget {
  readonly #headless: boolean;
  #native: NativeCommandHost | null = null;
  readonly #navigation = new GpuiNavigation(this);

  readonly location = this.#navigation;
  readonly history = this.#navigation;
  readonly document = { title: '' };

  constructor(options: GpuiHostOptions = {}) {
    super();
    this.#headless = options.headless ?? false;
  }

  get isInitialized(): boolean {
    return this.#native !== null;
  }

  get rootId(): number {
    return this.#requireNative().rootId;
  }

  get poisoned(): boolean {
    return this.#native?.poisoned ?? false;
  }

  get nativeClosed(): boolean {
    return this.#native?.closed ?? false;
  }

  init(options: GpuiWindowOptions = {}): void {
    if (this.#native)
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
    this.#native = new NativeCommandHost({
      headless: this.#headless,
      window: {
        title: options.title,
        width: options.width,
        height: options.height,
      },
      onClose: () => this.dispatchEvent(new Event('close')),
    });
  }

  setWindowTitle(title: string): void {
    this.#requireNative().setWindowTitle(title);
    this.document.title = title;
  }

  resetLocation(path: string): void {
    this.history.reset(path);
  }

  createNode(kind: ElementKindValue): number {
    return this.#requireNative().createNode(kind);
  }

  createText(text: string): number {
    return this.#requireNative().createText(text);
  }

  updateText(id: number, text: string): void {
    this.#requireNative().updateText(id, text);
  }

  setProperty(
    id: number,
    property: PropertyIdValue,
    value: ProtocolPropertyValue
  ): void {
    this.#requireNative().setProperty(id, property, value);
  }

  setStyle(
    id: number,
    properties: readonly (readonly [PropertyIdValue, ProtocolPropertyValue])[]
  ): void {
    this.#requireNative().setStyle(id, properties);
  }

  insertChild(parentId: number, childId: number, beforeId = 0): void {
    this.#requireNative().insertChild(parentId, childId, beforeId);
  }

  removeChild(parentId: number, childId: number): void {
    this.#requireNative().removeChild(parentId, childId);
  }

  flush(): void {
    this.#requireNative().flush();
  }

  settle(): void {
    this.#requireNative().settle();
  }

  close(): void {
    this.#native?.close();
    this.#native = null;
  }

  /** @internal Test/diagnostic retained-tree snapshot. */
  debugTree(): unknown {
    return this.#requireNative().debugTree();
  }

  #requireNative(): NativeCommandHost {
    if (!this.#native) {
      throw new Error(
        'RetendGpuiRenderer.init() must be called before native work.'
      );
    }
    return this.#native;
  }
}

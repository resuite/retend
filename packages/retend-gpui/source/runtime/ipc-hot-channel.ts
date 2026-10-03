import type { ChildProcess } from 'node:child_process';

import { isViteIpcMessage } from './protocol.js';

type HotClient = { send(payload: unknown): void };
type HotHandler = (data: unknown, client: HotClient) => void;

interface ChildBinding {
  child: ChildProcess;
  client: HotClient;
  onMessage: (message: unknown) => void;
  onExit: () => void;
}

/** Vite hot channel backed by the single GPUI application child process. */
export class IpcHotChannel {
  readonly skipFsCheck = true;

  readonly #handlers = new Map<string, Set<HotHandler>>();
  #binding: ChildBinding | null = null;

  send(payload: unknown): void {
    this.#binding?.client.send(payload);
  }

  on(event: string, handler: HotHandler): void {
    let handlers = this.#handlers.get(event);
    if (!handlers) this.#handlers.set(event, (handlers = new Set()));
    handlers.add(handler);

    if (event === 'vite:client:connect' && this.#binding) {
      handler(undefined, this.#binding.client);
    }
  }

  off(event: string, handler: HotHandler): void {
    this.#handlers.get(event)?.delete(handler);
  }

  attach(child: ChildProcess): void {
    if (this.#binding?.child === child) return;
    if (this.#binding) this.detach(this.#binding.child);

    const client: HotClient = {
      send(payload) {
        if (child.connected) child.send({ channel: 'vite', payload });
      },
    };
    const onMessage = (message: unknown): void => {
      if (!isViteIpcMessage(message)) return;
      const payload = message.payload;
      if (
        typeof payload !== 'object' ||
        payload === null ||
        Reflect.get(payload, 'type') !== 'custom'
      ) {
        return;
      }

      const event = Reflect.get(payload, 'event');
      if (typeof event === 'string') {
        this.#emit(event, Reflect.get(payload, 'data'), client);
      }
    };
    const onExit = (): void => {
      this.detach(child);
      this.#emit('vite:client:disconnect', undefined, client);
    };

    this.#binding = { child, client, onMessage, onExit };
    child.on('message', onMessage);
    child.once('exit', onExit);
    this.#emit('vite:client:connect', undefined, client);
  }

  detach(child: ChildProcess): void {
    const binding = this.#binding;
    if (!binding || binding.child !== child) return;
    this.#binding = null;
    child.off('message', binding.onMessage);
    child.off('exit', binding.onExit);
  }

  #emit(event: string, data: unknown, client: HotClient): void {
    for (const handler of this.#handlers.get(event) ?? []) {
      handler(data, client);
    }
  }
}

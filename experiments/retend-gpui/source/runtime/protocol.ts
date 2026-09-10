import type { GpuiWindowOptions } from '../window.js';

export interface DevRuntimeInitMessage {
  channel: 'retend-gpui';
  type: 'init';
  appName: string;
  application: string;
  entry: string;
  options: GpuiWindowOptions &
    Required<Pick<GpuiWindowOptions, 'title' | 'location'>>;
}

export type DevRuntimeConfig = Omit<DevRuntimeInitMessage, 'channel' | 'type'>;

export type GpuiControlMessage =
  | DevRuntimeInitMessage
  | {
      channel: 'retend-gpui';
      type: 'close-application' | 'application-ready';
    }
  | {
      channel: 'retend-gpui';
      type: 'application-startup-error';
      message: string;
    };

export interface ViteIpcMessage {
  channel: 'vite';
  payload: unknown;
}

export function isGpuiControlMessage(
  value: unknown
): value is GpuiControlMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'channel') === 'retend-gpui' &&
    typeof Reflect.get(value, 'type') === 'string'
  );
}

export function isDevRuntimeInitMessage(
  value: unknown
): value is DevRuntimeInitMessage {
  return isGpuiControlMessage(value) && value.type === 'init';
}

export function isViteIpcMessage(value: unknown): value is ViteIpcMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'channel') === 'vite' &&
    'payload' in value
  );
}

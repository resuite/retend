import type { GpuiApplication } from 'retend-gpui';

export default class Application implements GpuiApplication<object> {
  readonly context = {};

  init(): void {
    setTimeout(() => process.exit(1), 15_000);
  }

  cleanup(): void {}
}

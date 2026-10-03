import type { GpuiApplication } from 'retend-gpui';

interface ApplicationContext {
  startedAt: Date;
}

export default class Application implements GpuiApplication<ApplicationContext> {
  readonly context: ApplicationContext = {
    startedAt: new Date(),
  };

  init(): void {}

  cleanup(): void {}
}
